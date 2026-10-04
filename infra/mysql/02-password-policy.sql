INSTALL COMPONENT 'file://component_validate_password';
SET PERSIST validate_password.policy = 1;
SET PERSIST validate_password.length = 16;
SET PERSIST generated_random_password_length = 32;
SHOW VARIABLES LIKE 'validate_password.%';
SELECT @@generated_random_password_length;
