CREATE TABLE "CampaignTemplateDraft" (
 "id" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "language" TEXT NOT NULL,
 "body" TEXT NOT NULL,
 "parameterCount" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CampaignTemplateDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CampaignTemplateDraft_name_language_idx" ON "CampaignTemplateDraft"("name", "language");
ALTER TABLE "Campaign" ADD COLUMN "templateBody" TEXT, ADD COLUMN "templateLanguage" TEXT;
