-- Migration 014: Notifications table for real-time user notifications

CREATE TABLE IF NOT EXISTS v2_notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  notification_type ENUM('info','warning','success','error') NOT NULL DEFAULT 'info',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  module_name VARCHAR(50) NULL,
  entity_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_notif_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_notif_user FOREIGN KEY (user_id) REFERENCES v2_users(id),
  KEY idx_v2_notif_user_unread (school_id, user_id, is_read, created_at),
  KEY idx_v2_notif_user_list (school_id, user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
