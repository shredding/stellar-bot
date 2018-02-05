FROM node:latest

RUN mkdir /usr/src/app
WORKDIR /usr/src/app

COPY ./package.json /usr/src/app/package.json
COPY ./package-lock.json /usr/src/app/package-lock.json

RUN npm install

COPY . /usr/src/app
CMD ["npm","run", "app"]
