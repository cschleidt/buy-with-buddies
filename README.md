Deployment:

Opret 2 environments i github: staging og production

Tilføj følgende secrets ti hvert environment:

AZURE_RESOURCE_GROUP = rg-buy-with-buddies-<environment navn>
AZURE_WEBAPP_NAME = buy-with-buddies-<environment-name>
AZURE_WEBAPP_PUBLISH_PROFILE = { publishing profile for hver rg, download og indsæt xml i secret }
