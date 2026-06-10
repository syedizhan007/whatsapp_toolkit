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
   * Send message with auto-retry and exponential backoff
   * @param {Object} sock - Baileys socket
   * @param {string} jid - WhatsApp JID
   * @param {Object} content - Message content object
   * @param {number} maxRetries - Maximum retry attempts (default: 3)
   * @returns {Promise<Object>} Send result
   */
  async sendMessageWithRetry(sock, jid, content, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Attempt to send the message
        const result = await sock.sendMessage(jid, content);

        if (attempt > 0) {
          console.log(`   ✅ Succeeded on retry attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          // Calculate exponential backoff delay: 2^attempt * 1000ms
          const backoffDelay = Math.pow(2, attempt) * 1000;
          console.log(`   ⚠️ Attempt ${attempt + 1} failed: ${error.message}`);
          console.log(`   ⏳ Retrying in ${backoffDelay/1000}s... (${attempt + 1}/${maxRetries} retries)`);

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    // All retries exhausted - throw the last error
    console.log(`   ❌ All ${maxRetries} retry attempts exhausted`);
    throw lastError;
  }

  /**
   * Send bulk messages for a campaign
   * @param {string} userId - User ID
   * @param {Array} contacts - Array of contacts with phone, name, etc.
   * @param {string|Array<string>} message - Message template (single string) or array of templates for rotation
   * @param {Array} mediaFiles - Optional media files
   * @param {Object} options - Campaign options (delay, etc.)
   */
  async sendBulkMessages(userId, contacts, message, mediaFiles = [], options = {}) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const sock = this.getSocket(userId);
    const delay = options.delay || 10000; // Default 10 seconds between messages

    // Template rotation setup
    const isTemplateRotation = Array.isArray(message);
    const templates = isTemplateRotation ? message : [message];

    // Validate templates
    if (templates.length === 0 || templates.some(t => !t || typeof t !== 'string')) {
      throw new Error('Invalid message templates provided');
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    console.log(`\n🚀 Starting bulk send for user ${userId}`);
    console.log(`📊 Total contacts: ${contacts.length}`);
    if (isTemplateRotation) {
      console.log(`🔄 Template rotation enabled: ${templates.length} templates`);
    }

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

        // Template rotation: randomly select one template from the array
        const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];

        // Personalize message with contact data
        let personalizedMessage = selectedTemplate
          .replace(/{name}/g, contact.name || 'there')
          .replace(/{city}/g, contact.city || '')
          .replace(/{tag}/g, contact.tag || '')
          .replace(/{phone}/g, contact.phone || '');

        if (isTemplateRotation) {
          console.log(`📤 Sending to ${contact.name} (${contact.phone}) - Template ${templates.indexOf(selectedTemplate) + 1}/${templates.length}`);
          console.log(`   Message: "${personalizedMessage.substring(0, 60)}..."`);
        } else {
          console.log(`📤 Sending to ${contact.name} (${contact.phone})...`);
        }

        // UNIFIED MESSAGE SENDING: Combine text + media into ONE message
        if (mediaFiles && mediaFiles.length > 0) {
          // Media present - send media with text as caption (SINGLE MESSAGE)
          const media = mediaFiles[0]; // Use first media file

          try {
            console.log(`📎 Sending media with message caption: ${media.filename || media.url}`);

            if (media.url) {
              // Send from URL with retry
              await this.sendMessageWithRetry(sock, jid, {
                image: { url: media.url },
                caption: personalizedMessage // Use personalized message as caption
              });
            } else if (media.buffer) {
              // Send from buffer with retry
              await this.sendMessageWithRetry(sock, jid, {
                image: media.buffer,
                caption: personalizedMessage // Use personalized message as caption
              });
            }

            console.log(`✅ Media + message sent successfully (single delivery)`);

            // Send additional media files if present (without duplicate text)
            if (mediaFiles.length > 1) {
              console.log(`📎 Sending ${mediaFiles.length - 1} additional media file(s)...`);
              for (let i = 1; i < mediaFiles.length; i++) {
                const additionalMedia = mediaFiles[i];
                try {
                  await new Promise(resolve => setTimeout(resolve, 2000)); // Small delay

                  if (additionalMedia.url) {
                    await this.sendMessageWithRetry(sock, jid, {
                      image: { url: additionalMedia.url },
                      caption: '' // No caption for additional files
                    });
                  } else if (additionalMedia.buffer) {
                    await this.sendMessageWithRetry(sock, jid, {
                      image: additionalMedia.buffer,
                      caption: '' // No caption for additional files
                    });
                  }
                  console.log(`   ✅ Additional media ${i}/${mediaFiles.length - 1} sent`);
                } catch (mediaError) {
                  console.error(`   ❌ Failed to send additional media ${i}:`, mediaError.message);
                }
              }
            }
          } catch (mediaError) {
            console.error(`❌ Failed to send media:`, mediaError.message);
            throw mediaError; // Propagate to outer catch for failure tracking
          }
        } else {
          // No media - send text-only message with auto-retry
          await this.sendMessageWithRetry(sock, jid, { text: personalizedMessage });
          console.log(`✅ Text message sent successfully`);
        }

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
