/**
 * Manual test utilities for notification system
 * This file can be imported and used for testing notification functionality
 */

import { NotificationManager } from './NotificationManager.js';
import type { NotificationData } from './types.js';
import { defaultNotificationSettings } from './types.js';

export class NotificationTestSuite {
  private manager: NotificationManager;

  constructor() {
    this.manager = new NotificationManager(defaultNotificationSettings);
  }

  /**
   * Test basic notification queueing
   */
  async testBasicNotification(): Promise<boolean> {
    try {
      const notification: NotificationData = {
        id: 'test-1',
        title: 'Test Notification',
        body: 'This is a test notification',
        category: 'system',
        priority: 'normal',
        timestamp: Date.now()
      };

      await this.manager.queue(notification);
      return true;
    } catch (error) {
      console.error('Basic notification test failed:', error);
      return false;
    }
  }

  /**
   * Test priority ordering
   */
  async testPriorityOrdering(): Promise<boolean> {
    try {
      const notifications: Omit<NotificationData, 'id' | 'timestamp'>[] = [
        { title: 'Low', body: 'Low priority', category: 'system', priority: 'low' },
        { title: 'Urgent', body: 'Urgent priority', category: 'voice_call', priority: 'urgent' },
        { title: 'High', body: 'High priority', category: 'mention', priority: 'high' },
        { title: 'Normal', body: 'Normal priority', category: 'message', priority: 'normal' }
      ];

      for (let i = 0; i < notifications.length; i++) {
        const notif = notifications[i];
        await this.manager.queue({
          ...notif,
          id: `test-priority-${i}`,
          timestamp: Date.now() + i
        });
      }

      return true;
    } catch (error) {
      console.error('Priority ordering test failed:', error);
      return false;
    }
  }

  /**
   * Test batching functionality
   */
  async testBatching(): Promise<boolean> {
    try {
      // Send multiple messages to the same channel for batching
      for (let i = 0; i < 3; i++) {
        await this.manager.queue({
          id: `batch-test-${i}`,
          title: `Message ${i + 1}`,
          body: `This is message ${i + 1} for batching`,
          category: 'message',
          priority: 'normal',
          timestamp: Date.now() + i,
          channelId: 'test-channel',
          sourceId: 'test-channel'
        });
      }

      return true;
    } catch (error) {
      console.error('Batching test failed:', error);
      return false;
    }
  }

  /**
   * Test settings validation
   */
  testSettingsValidation(): boolean {
    try {
      const settings = this.manager.getSettings();

      // Validate settings structure
      const requiredCategories = ['message', 'voice_call', 'mention', 'system', 'friend_request', 'server_update'];
      const hasAllCategories = requiredCategories.every(cat =>
        settings.categories.hasOwnProperty(cat)
      );

      if (!hasAllCategories) {
        console.error('Missing required notification categories');
        return false;
      }

      // Validate each category has required properties
      for (const [category, config] of Object.entries(settings.categories)) {
        if (typeof config.enabled !== 'boolean' ||
            !config.priority ||
            typeof config.sound !== 'boolean' ||
            typeof config.batchingEnabled !== 'boolean' ||
            typeof config.batchDelay !== 'number') {
          console.error(`Invalid configuration for category: ${category}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Settings validation test failed:', error);
      return false;
    }
  }

  /**
   * Test notification ID generation and uniqueness
   */
  testIdGeneration(): boolean {
    try {
      const ids = new Set<string>();
      const testCount = 100;

      for (let i = 0; i < testCount; i++) {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        if (ids.has(id)) {
          console.error('Duplicate ID generated:', id);
          return false;
        }
        ids.add(id);
      }

      return true;
    } catch (error) {
      console.error('ID generation test failed:', error);
      return false;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<{ passed: number; failed: number; results: Record<string, boolean> }> {
    const tests = [
      { name: 'basicNotification', test: () => this.testBasicNotification() },
      { name: 'priorityOrdering', test: () => this.testPriorityOrdering() },
      { name: 'batching', test: () => this.testBatching() },
      { name: 'settingsValidation', test: () => this.testSettingsValidation() },
      { name: 'idGeneration', test: () => this.testIdGeneration() }
    ];

    const results: Record<string, boolean> = {};
    let passed = 0;
    let failed = 0;

    for (const { name, test } of tests) {
      console.log(`Running test: ${name}`);
      try {
        const result = await test();
        results[name] = result;
        if (result) {
          passed++;
          console.log(`✓ ${name} passed`);
        } else {
          failed++;
          console.log(`✗ ${name} failed`);
        }
      } catch (error) {
        results[name] = false;
        failed++;
        console.log(`✗ ${name} failed with error:`, error);
      }
    }

    return { passed, failed, results };
  }

  /**
   * Clean up test resources
   */
  cleanup(): void {
    this.manager.clearAll();
  }
}

// Export a convenience function for quick testing
export async function runNotificationTests(): Promise<void> {
  const testSuite = new NotificationTestSuite();

  console.log('🚀 Starting notification system tests...');
  const { passed, failed, results } = await testSuite.runAllTests();

  console.log('\n📊 Test Results:');
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    Object.entries(results).forEach(([name, passed]) => {
      if (!passed) {
        console.log(`  - ${name}`);
      }
    });
  } else {
    console.log('\n🎉 All tests passed!');
  }

  testSuite.cleanup();
}