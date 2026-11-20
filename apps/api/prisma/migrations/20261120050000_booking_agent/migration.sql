ALTER TABLE "PlotBooking" ADD COLUMN "agentId" TEXT;
ALTER TABLE "PlotBooking" ADD CONSTRAINT "PlotBooking_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "PlotBooking_agentId_idx" ON "PlotBooking"("agentId");
