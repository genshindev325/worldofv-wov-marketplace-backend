# wov-marketplace-backend

## Setting up the local development server

In order to set up a development environment you will need to have this software running:

- s3 compatible object storage
- Redis
- Postgres

This repository come with a preconfigured development container with all the dependent services preinstalled. For more information refer to https://code.visualstudio.com/docs/remote/containers

You can also choose to install all the required software on your host machine and modify the .env file.

Next you will need to set up the repository:

```bash
npm install
npm run prisma:generate # This needs to run after every install/update
```

Deploy the database schema to your server:

```bash
npm run prisma:deploy # This needs to every time a new migration is created
```

At this point you can start the server:

```bash
npm run start:all
```
