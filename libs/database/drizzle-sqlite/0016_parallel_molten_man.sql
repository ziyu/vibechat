UPDATE `space_agent_binding`
SET `is_default` = 0
WHERE `binding_id` IN (
	SELECT `binding_id`
	FROM (
		SELECT `binding_id`, row_number() OVER (
			PARTITION BY `space_instance_id`
			ORDER BY `updated_at` DESC, `binding_id` ASC
		) AS `position`
		FROM `space_agent_binding`
		WHERE `is_default` = 1
	)
	WHERE `position` > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX `space_agent_binding_one_default_idx` ON `space_agent_binding` (`space_instance_id`) WHERE "space_agent_binding"."is_default" = true;
