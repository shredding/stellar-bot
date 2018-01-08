#!/usr/bin/env bash
git pull
docker build -t stellar-bot .

docker stop app || true && docker rm app || true
docker run --restart=always --link=db:db -itd --name app stellar-bot:latest