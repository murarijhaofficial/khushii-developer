CREATE TABLE "WebsiteForm" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "projectId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteForm_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Lead" ADD COLUMN "websiteFormId" TEXT;
CREATE INDEX "WebsiteForm_projectId_idx" ON "WebsiteForm"("projectId");
CREATE INDEX "Lead_websiteFormId_idx" ON "Lead"("websiteFormId");
ALTER TABLE "WebsiteForm" ADD CONSTRAINT "WebsiteForm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_websiteFormId_fkey" FOREIGN KEY ("websiteFormId") REFERENCES "WebsiteForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
