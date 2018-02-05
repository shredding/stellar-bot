FROM node:latest

RUN apt-get upgrade -y
RUN apt-get update
RUN apt-get install -y build-essential
RUN mkdir /usr/src/app
WORKDIR /usr/src/app

COPY ./package.json /usr/src/app/package.json
COPY ./package-lock.json /usr/src/app/package-lock.json

RUN npm install

COPY . /usr/src/app
CMD ["npm","run", "app"]
