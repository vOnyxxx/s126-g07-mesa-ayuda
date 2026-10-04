SET SESSION generated_random_password_length = 32;
CREATE USER 'app_mesa'@'100.70.226.73'
    IDENTIFIED WITH caching_sha2_password BY RANDOM PASSWORD
    REQUIRE SSL;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON mesa_ayuda.*
    TO 'app_mesa'@'100.70.226.73';
