-- Separate migration: Postgres refuses to use an enum value added in the same transaction
-- ("unsafe use of new value PERSONA_RELAY"). Runs after 20261020130000_commerce_flows has committed.
-- Relay copies written before PERSONA_RELAY existed: persona -> its manager, content "[Name] ...".
UPDATE "Message" m SET "type" = 'PERSONA_RELAY'
FROM "User" u
WHERE m."senderId" = u."id" AND u."isPersonaAccount" = true AND m."receiverId" = u."managedByUserId"
  AND m."type" = 'SYSTEM_INFO' AND m."content" LIKE '[%';

