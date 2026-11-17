CREATE TABLE "LeadEnquiry" (
 "id" TEXT NOT NULL, "leadId" TEXT NOT NULL, "externalId" TEXT, "name" TEXT NOT NULL,
 "phone" TEXT NOT NULL, "email" TEXT, "source" TEXT NOT NULL, "message" TEXT,
 "projectId" TEXT, "websiteFormId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LeadEnquiry_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "LeadEnquiry_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LeadEnquiry_externalId_key" ON "LeadEnquiry"("externalId");
CREATE INDEX "LeadEnquiry_leadId_createdAt_idx" ON "LeadEnquiry"("leadId", "createdAt");
INSERT INTO "LeadEnquiry" ("id", "leadId", "externalId", "name", "phone", "email", "source", "message", "projectId", "websiteFormId", "createdAt")
 SELECT 'legacy-' || "id", "id", "externalId", "name", "phone", "email", "source", "message", "projectId", "websiteFormId", "createdAt" FROM "Lead";
