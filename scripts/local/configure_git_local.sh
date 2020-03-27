#!/bin/bash

# RUN 1ST PART OF configure_git_server.sh

eval "$(ssh-agent -s)"
chmod 400 ../keys/ec2-ssh
ssh-add ../keys/ec2-ssh

. ../../config.sh

ssh-keyscan -H $SERVER_DOMAIN >> ~/.ssh/known_hosts

git remote remove ec2
git remote add ec2 "ubuntu@"$SERVER_DOMAIN":/home/ubuntu/project.git"
git push -u ec2 devops

# RUN 2ND PART OF configure_git_server.sh