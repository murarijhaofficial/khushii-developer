ALTER TABLE "Campaign" ADD COLUMN "templateId" TEXT, ADD COLUMN "parameters" JSONB, ADD COLUMN "startedById" TEXT;
CREATE TABLE "CampaignRecipient" (
 "id" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "leadId" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "error" TEXT, "claimedAt" TIMESTAMP(3), "outboundMessageId" TEXT,
 CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "CampaignRecipient_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CampaignRecipient_outboundMessageId_fkey" FOREIGN KEY ("outboundMessageId") REFERENCES "OutboundMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_leadId_key" ON "CampaignRecipient"("campaignId", "leadId");
CREATE UNIQUE INDEX "CampaignRecipient_outboundMessageId_key" ON "CampaignRecipient"("outboundMessageId");
CREATE INDEX "CampaignRecipient_campaignId_status_idx" ON "CampaignRecipient"("campaignId", "status");
