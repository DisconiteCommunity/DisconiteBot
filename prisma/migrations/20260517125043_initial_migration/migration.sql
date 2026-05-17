-- CreateTable
CREATE TABLE `guild_settings` (
    `guild_id` VARCHAR(32) NOT NULL,
    `metrics_channel_id` VARCHAR(32) NULL,
    `metrics_message_id` VARCHAR(32) NULL,
    `metrics_world_previews` BOOLEAN NOT NULL DEFAULT false,
    `extras` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`guild_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
