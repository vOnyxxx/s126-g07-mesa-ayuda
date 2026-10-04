#!/usr/bin/env bash
set -euo pipefail
umask 077

backup_dir=/var/backups/mesa_ayuda
recipient_file=/etc/sg/backup-recipient.txt

install -d -m 700 "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
temporary=$(mktemp "$backup_dir/.mesa_ayuda-${stamp}.XXXXXX")
final="$backup_dir/mesa_ayuda-${stamp}.sql.age"

trap 'rm -f -- "$temporary"' EXIT

/usr/bin/mysqldump \
    --protocol=socket \
    --user=root \
    --single-transaction \
    --quick \
    --routines \
    --events \
    --triggers \
    --hex-blob \
    --no-tablespaces \
    --set-gtid-purged=OFF \
    mesa_ayuda |
    /usr/bin/age -R "$recipient_file" > "$temporary"

test -s "$temporary"
chmod 600 "$temporary"
mv -- "$temporary" "$final"
printf 'Respaldo cifrado: %s\n' "$final"
