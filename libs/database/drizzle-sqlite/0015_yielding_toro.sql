ALTER TABLE `space_agent_definition` ADD `execution_pool_policy_json` text DEFAULT '{"mode":"regional_shared","poolClass":null}' NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `space_agent_definition` (
	`definition_id`, `agent_id`, `version`, `adapter_key`, `adapter_version`,
	`provider`, `model`, `capabilities_json`, `tool_policy_id`, `pricing_policy_id`,
	`usage_schema_version`, `max_budget_credits`, `max_concurrency`, `data_region_policy_json`,
	`execution_pool_policy_json`, `display_name`, `description`, `status`, `availability`,
	`created_at`, `updated_at`
) VALUES (
	'agent-definition-claude-v1', 'claude', '1.0.0', 'claude-code', '0.2.7',
	'anthropic', 'configured', '["conversation","project_patch"]',
	'space-agent-tools-default', 'space-agent-pricing-default',
	'vibechat.agent-usage/v1', 1000, 1, '{"mode":"any","regions":[]}',
	'{"mode":"regional_shared","poolClass":null}',
	'Claude Code', 'Managed Claude Code Agent for VibeChat Space projects',
	'active', 'available',
	strftime('%s', '2026-08-27T00:00:00Z'), strftime('%s', '2026-08-27T00:00:00Z')
);
