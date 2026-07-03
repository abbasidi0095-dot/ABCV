-- AlterTable: add Cognito User Pool subject for Hosted UI auth
ALTER TABLE "User" ADD COLUMN "cognitoSub" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_cognitoSub_key" ON "User"("cognitoSub");
