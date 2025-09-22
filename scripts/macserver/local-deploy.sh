scp -r ./app/clients/icloud/macserver localmacserver:~/blot/app/clients/icloud/

ssh localmacserver "export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\" && pm2 restart macserver"