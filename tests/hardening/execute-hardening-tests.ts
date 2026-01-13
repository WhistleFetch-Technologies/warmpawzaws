#!/usr/bin/env node
/**
 * ============================================================================
 * HARDENING TESTS EXECUTOR
 * ============================================================================
 * 
 * Execute all 120 hardening tests with automatic remediation
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

import { HardeningTestExecutor } from './hardening-executor';
import { registerLayer1Tests } from './layer1-data-integrity';
import { registerLayer2Tests } from './layer2-state-machine';
import { registerLayer3Tests } from './layer3-financial';
import { registerLayer4Tests } from './layer4-security';
import { registerLayer5Tests } from './layer5-observability';
import { registerLayer6Tests } from './layer6-chaos';
import { registerLayer7Tests } from './layer7-scale';

// Register all tests
registerLayer1Tests();
registerLayer2Tests();
registerLayer3Tests();
registerLayer4Tests();
registerLayer5Tests();
registerLayer6Tests();
registerLayer7Tests();

// Execute
const executor = new HardeningTestExecutor();
executor.executeAllTests().catch(console.error);
