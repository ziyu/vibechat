import type { AgentUsage } from "../agent-usage.js";
import type {
  ClaimedSpaceTurn,
  SpaceTurnRecovery,
} from "../space-instance-server.js";
import type { SpaceTurnReply } from "../turn-callbacks.js";

export interface ClaimedAgentTurnOutcome {
  succeeded: boolean;
  usage?: AgentUsage;
  reply?: SpaceTurnReply;
}

export interface ClaimedTurnExecutorDependencies {
  defaultAgentId: string;
  executeAgentTurn(input: {
    spaceInstanceId: string;
    turn: ClaimedSpaceTurn;
    agentId: string;
  }): Promise<ClaimedAgentTurnOutcome>;
  executePublishTurn(input: {
    spaceInstanceId: string;
    turnId: string;
    expectedReadyRevisionId: string;
  }): Promise<boolean>;
  executeRestoreTurn(input: {
    spaceInstanceId: string;
    turnId: string;
    recovery: SpaceTurnRecovery;
  }): Promise<boolean>;
  failTurn(input: {
    spaceInstanceId: string;
    turnId: string;
    error: unknown;
  }): Promise<void>;
  reportBilling(input: {
    turn: ClaimedSpaceTurn;
    status: "completed" | "failed";
    usage?: AgentUsage;
  }): Promise<void>;
  reportCompletion(input: {
    turn: ClaimedSpaceTurn;
    reply: SpaceTurnReply;
  }): Promise<void>;
  reportError(message: string, error: unknown): void;
}

export class ClaimedTurnExecutor {
  readonly #dependencies: ClaimedTurnExecutorDependencies;

  constructor(dependencies: ClaimedTurnExecutorDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(spaceInstanceId: string, turn: ClaimedSpaceTurn) {
    let succeeded = false;
    let usage: AgentUsage | undefined;
    let reply: SpaceTurnReply | undefined;
    try {
      if (turn.kind === "publish") {
        const publication = turn.requests[0]?.publication;
        if (!publication) {
          throw new Error("Space publish request is missing revision metadata");
        }
        succeeded = await this.#dependencies.executePublishTurn({
          spaceInstanceId,
          turnId: turn.turnId,
          expectedReadyRevisionId: publication.expectedReadyRevisionId,
        });
      } else if (turn.kind === "restore") {
        const recovery = turn.requests[0]?.recovery;
        if (!recovery) {
          throw new Error("Space restore request is missing recovery metadata");
        }
        succeeded = await this.#dependencies.executeRestoreTurn({
          spaceInstanceId,
          turnId: turn.turnId,
          recovery,
        });
      } else {
        const agentId =
          turn.requests[0]?.agentId || this.#dependencies.defaultAgentId;
        const outcome = await this.#dependencies.executeAgentTurn({
          spaceInstanceId,
          turn,
          agentId,
        });
        succeeded = outcome.succeeded;
        usage = outcome.usage;
        reply = outcome.reply;
      }
    } catch (error) {
      this.#dependencies.reportError("Queued turn failed", error);
      await this.#dependencies.failTurn({
        spaceInstanceId,
        turnId: turn.turnId,
        error,
      });
    } finally {
      await Promise.all([
        this.#dependencies
          .reportBilling({
            turn,
            status: succeeded ? "completed" : "failed",
            usage,
          })
          .catch((error) => {
            this.#dependencies.reportError(
              "Space turn billing callback failed",
              error,
            );
          }),
        ...(succeeded && reply
          ? [
              this.#dependencies
                .reportCompletion({ turn, reply })
                .catch((error) => {
                  this.#dependencies.reportError(
                    "Space turn completion callback failed",
                    error,
                  );
                }),
            ]
          : []),
      ]);
    }
  }
}
