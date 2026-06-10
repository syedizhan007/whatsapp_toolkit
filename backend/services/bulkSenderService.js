const path = require('path');
const fs = require('fs');
const { gaussianDelay } = require('../utils/helpers');

/**
 * Bulk Sender Service - Baileys Compatible
 * This service integrates with the main server's Baileys WhatsApp clients
 */
class BulkSenderService {
  constructor() {
    this.whatsappClients = null;
    this.io = null;
    this.isInitialized = false;
  }

  /**
   * Initialize service with WhatsApp clients from main server
   */
  initialize(whatsappClients, io) {
    this.whatsappClients = whatsappClients;
    this.io = io;
    this.isInitialized = true;
    console.log('✓ Bulk Sender Service initialized with Baileys integration');
  }

  /**
   * Get WhatsApp socket for a specific user
   */
  getSocket(userId) {
    if (!this.whatsappClients || !this.whatsappClients.has(userId)) {
      throw new Error(`No WhatsApp client found for user ${userId}`);
    }

    const userData = this.whatsappClients.get(userId);

    if (!userData.isReady || !userData.client) {
      throw new Error(`WhatsApp client not ready for user ${userId}`);
    }

    return userData.client;
  }

  /**
   * Send bulk messages for a campaign
   * @param {string} userId - User ID
   * @param {Array} contacts - Array of contacts with phone, name, etc.
   * @param {string} message - Message template
   * @param {Array} mediaFiles - Optional media files
   * @param {Object} options - Campaign options (delay, etc.)
   */
  async sendBulkMessages(userId, contacts, message, mediaFiles = [], options = {}) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const sock = this.getSocket(userId);
    const delay = options.delay || 10000; // Default 10 seconds between messages

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    console.log(`\n🚀 Starting bulk send for user ${userId}`);
    console.log(`📊 Total contacts: ${contacts.length}`);

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      // Check if campaign should stop
      if (options.stopRequested && options.stopRequested()) {
        console.log(`🛑 Campaign stopped by user at ${sent}/${contacts.length}`);
        break;
      }

      // Check if campaign is paused
      while (options.isPaused && options.isPaused()) {
        console.log(`⏸️ Campaign paused, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (options.stopRequested && options.stopRequested()) {
          console.log(`🛑 Campaign stopped while paused`);
          return { sent, failed, skipped };
        }
      }

      try {
        // Format phone number for Baileys
        let phoneNumber = contact.phone.replace(/[^0-9]/g, '');

        // Pakistani number sanitization: remove leading 0 and prefix with 92
        if (phoneNumber.startsWith('0')) {
          phoneNumber = '92' + phoneNumber.substring(1);
        }

        // Add @c.us suffix for Baileys
        const jid = phoneNumber + '@s.whatsapp.net';

        // Personalize message
        let personalizedMessage = message
          .replace(/{name}/g, contact.name || 'there')
          .replace(/{city}/g, contact.city || '')
          .replace(/{tag}/g, contact.tag || '')
          .replace(/{phone}/g, contact.phone || '');

        console.log(`📤 Sending to ${contact.name} (${contact.phone})...`);

        // Send text message using Baileys
        await sock.sendMessage(jid, { text: personalizedMessage });
        console.log(`✅ Message sent successfully`);

        sent++;

        // Emit progress update via Socket.IO
        if (this.io && options.campaignId) {
          this.io.to(userId).emit('bulk-campaign:progress', {
            campaignId: options.campaignId,
            sent,
            failed,
            skipped,
            pending: contacts.length - sent - failed - skipped,
            current: contact.phone
          });
        }

        // Send media files if provided
        if (mediaFiles && mediaFiles.length > 0) {
          for (const media of mediaFiles) {
            try {
              console.log(`📎 Sending media: ${media.filename || media.url}`);

              if (media.url) {
                // Send from URL
                await sock.sendMessage(jid, {
                  image: { url: media.url },
                  caption: media.caption || ''
                });
              } else if (media.buffer) {
                // Send from buffer
                await sock.sendMessage(jid, {
                  image: media.buffer,
                  caption: media.caption || ''
                });
              }

              console.log(`✅ Media sent successfully`);

              // Small delay between media files
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (mediaError) {
              console.error(`❌ Failed to send media:`, mediaError.message);
              // Continue even if media fails
            }
          }
        }

        // Gaussian delay before next contact - mimics human behavior
        console.log(`⏳ Applying human-like delay before next contact...`);
        const actualDelay = await gaussianDelay();
        console.log(`⏳ Waited ${(actualDelay/1000).toFixed(2)}s (Gaussian distributed)`);


      } catch (error) {
        // ROBUST ERROR HANDLING - DO NOT CRASH THE LOOP
        console.error(`❌ Failed to send to ${contact.name} (${contact.phone}):`, error.message);
        failed++;

        // Emit failure update via Socket.IO
        if (this.io && options.campaignId) {
          this.io.to(userId).emit('bulk-campaign:progress', {
            campaignId: options.campaignId,
            sent,
            failed,
            skipped,
            pending: contacts.length - sent - failed - skipped,
            current: contact.phone,
            error: error.message
          });
        }

        // CONTINUE TO NEXT NUMBER - DO NOT CRASH
        continue;
      }
    }

    console.log(`\n✅ Bulk send completed for user ${userId}`);
    console.log(`📊 Sent: ${sent}, Failed: ${failed}, Skipped: ${skipped}`);

    return { sent, failed, skipped };
  }

  /**
   * Extract groups for a user using Baileys
   */
  async extractGroups(userId) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const sock = this.getSocket(userId);

    try {
      console.log(`📥 Fetching groups for user ${userId} using Baileys...`);

      // Use Baileys method to fetch all participating groups
      const groupsResponse = await sock.groupFetchAllParticipating();

      const groups = [];

      // Iterate over the groups object
      for (const [jid, group] of Object.entries(groupsResponse)) {
        groups.push({
          id: jid,
          name: group.subject || 'Unnamed Group',
          participantCount: group.participants ? group.participants.length : 0,
          desc: group.desc || '',
          owner: group.owner || null,
          creation: group.creation || null
        });
      }

      console.log(`✅ Found ${groups.length} groups for user ${userId}`);

      return {
        success: true,
        groups
      };
    } catch (error) {
      console.error(`❌ Error fetching groups for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract group members using Baileys with STRICT pushName lookup
   * Returns clean raw data for Excel export
   */
  async extractGroupMembers(userId, groupId, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const sock = this.getSocket(userId);

    try {
      console.log(`📥 Extracting members from group ${groupId} for user ${userId}...`);

      // Ensure group ID has proper format
      let formattedGroupId = groupId;
      if (!groupId.includes('@g.us')) {
        formattedGroupId = groupId + '@g.us';
      }

      // Fetch group metadata using Baileys
      const groupMetadata = await sock.groupMetadata(formattedGroupId);

      const members = [];
      const excludeAdmins = options.excludeAdmins || false;

      console.log(`✓ Found group: ${groupMetadata.subject} with ${groupMetadata.participants.length} participants`);

      // DEBUG: Log raw participants data to see what Baileys returns
      console.log('\n📋 RAW PARTICIPANTS DATA:');
      console.log(JSON.stringify(groupMetadata.participants, null, 2));
      console.log('');

      let skippedInvalid = 0;

      // CLEAN PARTICIPANT EXTRACTION LOOP
      for (let i = 0; i < groupMetadata.participants.length; i++) {
        const participant = groupMetadata.participants[i];

        try {
          // 1. Extract the raw JID safely - CHECK phoneNumber FIRST (new WhatsApp structure)
          const participantJid = participant.phoneNumber || participant.id || participant.jid;

          if (!participantJid) {
            console.log(`   ⚠️ [${i}] Skipped: No JID`);
            skippedInvalid++;
            continue;
          }

          // 2. POSITIVE FILTERING: Only keep real WhatsApp phone numbers
          // Accept: @s.whatsapp.net or @c.us (these are real phone numbers)
          // Reject: @lid (linked devices), @broadcast, anything else
          const isRealPhoneNumber = participantJid.includes('@s.whatsapp.net') || participantJid.includes('@c.us');

          if (!isRealPhoneNumber) {
            console.log(`   ⏭️ [${i}] Skipped non-phone JID: ${participantJid}`);
            skippedInvalid++;
            continue;
          }

          // 3. Clean phone number to digits only
          const phoneClean = participantJid.split('@')[0].replace(/\D/g, '');
          if (!phoneClean) {
            console.log(`   ⚠️ [${i}] Skipped: No phone after cleaning from ${participantJid}`);
            skippedInvalid++;
            continue;
          }

          // 4. Determine Admin Status (strictly lowercase 'yes' or 'no')
          let adminStatus = 'no';
          if (participant.admin === 'admin' || participant.admin === 'superadmin' || participant.isAdmin === true) {
            adminStatus = 'yes';
          }

          // 5. Skip admins if exclusion enabled
          if (excludeAdmins && adminStatus === 'yes') {
            console.log(`   ⏭️ [${i}] Skipped admin: ${phoneClean}`);
            continue;
          }

          // 6. Resolve Name (try multiple sources, default to 'WhatsApp User')
          let displayName = null;

          // Try participant object first (notify is the pushName)
          displayName = participant.notify || participant.name;

          // Try Baileys contact store if still not found
          if (!displayName && sock.store?.contacts?.[participantJid]) {
            displayName = sock.store.contacts[participantJid].pushName ||
                         sock.store.contacts[participantJid].name ||
                         sock.store.contacts[participantJid].notify;
          }

          // Final fallback to 'WhatsApp User' for professional Excel export
          if (!displayName) {
            displayName = 'WhatsApp User';
          }

          // 7. Add to members array
          members.push({
            name: displayName,
            phone: phoneClean,
            isAdmin: adminStatus,
            jid: participantJid
          });

          console.log(`   ✅ [${i}] Added: ${displayName} | ${phoneClean} | Admin: ${adminStatus}`);

        } catch (participantError) {
          console.error(`   ❌ Error processing participant at index ${i}:`, participantError.message);
          skippedInvalid++;
          continue;
        }
      }

      const finalCount = members.length;

      console.log(`\n📊 EXTRACTION COMPLETE:`);
      console.log(`   Total participants: ${groupMetadata.participants.length}`);
      console.log(`   Valid phone numbers extracted: ${finalCount}`);
      console.log(`   Invalid/linked devices skipped: ${skippedInvalid}`);

      if (finalCount === 0) {
        console.log('⚠️ No real WhatsApp phone numbers found');
      } else {
        console.log(`✅ Extracted ${finalCount} members from ${groupMetadata.subject}`);
      }

      return {
        success: true,
        groupName: groupMetadata.subject,
        groupId: formattedGroupId,
        members: members,
        total: members.length
      };
    } catch (error) {
      console.error(`❌ Error extracting group members for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Send message with media using Baileys
   */
  async sendMessageWithMedia(userId, jid, messageText, mediaUrl, caption = '') {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const sock = this.getSocket(userId);

    try {
      // Send text message first if provided
      if (messageText) {
        await sock.sendMessage(jid, { text: messageText });
      }

      // Send media
      if (mediaUrl) {
        await sock.sendMessage(jid, {
          image: { url: mediaUrl },
          caption: caption
        });
      }

      return { success: true };
    } catch (error) {
      console.error(`❌ Error sending message with media:`, error.message);
      throw error;
    }
  }

  /**
   * Check if user's WhatsApp is ready
   */
  isWhatsAppReady(userId) {
    if (!this.whatsappClients || !this.whatsappClients.has(userId)) {
      return false;
    }

    const userData = this.whatsappClients.get(userId);
    return userData.isReady && userData.client;
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new BulkSenderService();
    }
    return instance;
  }
};
