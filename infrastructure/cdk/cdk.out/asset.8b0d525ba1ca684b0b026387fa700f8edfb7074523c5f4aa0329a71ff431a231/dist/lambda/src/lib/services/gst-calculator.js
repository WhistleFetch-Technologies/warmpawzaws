"use strict";
/**
 * GST Calculator - Inline implementation for Lambda
 * Uses SQL queries to calculate GST based on rules
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateGST = calculateGST;
const db_1 = require("../db");
/**
 * Calculate GST based on role and service style
 */
async function calculateGST(params) {
    if (!params.amount || params.amount <= 0) {
        throw new Error('Invalid amount for GST calculation');
    }
    // Get GST rules from database
    const rules = await (0, db_1.selectQuery)('SELECT * FROM gst_rules WHERE enabled = true ORDER BY priority ASC', []);
    // Find matching rule
    let matchedRule = null;
    if (rules && rules.length > 0) {
        for (const rule of rules) {
            let matches = true;
            if (rule.role_id && params.roleId) {
                matches = matches && rule.role_id === params.roleId;
            }
            if (rule.service_style && params.serviceStyle) {
                matches = matches && rule.service_style === params.serviceStyle;
            }
            if (rule.category && params.category) {
                matches = matches && rule.category === params.category;
            }
            if (rule.min_amount) {
                matches = matches && params.amount >= rule.min_amount;
            }
            if (rule.max_amount) {
                matches = matches && params.amount <= rule.max_amount;
            }
            if (rule.vendor_state && params.vendorState) {
                matches = matches && rule.vendor_state === params.vendorState;
            }
            if (matches) {
                matchedRule = rule;
                break;
            }
        }
    }
    // Default rule (18% GST)
    if (!matchedRule) {
        matchedRule = {
            id: 'default',
            rule_name: 'Default GST Rule',
            gst_type: 'percentage',
            gst_rate: 18.00,
            cgst_percentage: 9,
            sgst_percentage: 9,
            igst_percentage: null
        };
    }
    // Calculate GST
    const isInterState = params.customerState && params.vendorState &&
        params.customerState !== params.vendorState;
    let gstAmount = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    if (matchedRule.gst_type === 'percentage') {
        gstAmount = (params.amount * matchedRule.gst_rate) / 100;
        if (isInterState) {
            // Inter-state: IGST
            if (matchedRule.igst_percentage) {
                igst = (params.amount * matchedRule.igst_percentage) / 100;
                gstAmount = igst;
            }
            else {
                igst = gstAmount;
            }
        }
        else {
            // Intra-state: CGST + SGST
            if (matchedRule.cgst_percentage && matchedRule.sgst_percentage) {
                cgst = (params.amount * matchedRule.cgst_percentage) / 100;
                sgst = (params.amount * matchedRule.sgst_percentage) / 100;
                gstAmount = cgst + sgst;
            }
            else {
                // Split 50-50 if not specified
                cgst = gstAmount / 2;
                sgst = gstAmount / 2;
            }
        }
    }
    else {
        // Fixed amount
        gstAmount = matchedRule.gst_rate;
        if (isInterState) {
            igst = gstAmount;
        }
        else {
            cgst = gstAmount / 2;
            sgst = gstAmount / 2;
        }
    }
    return {
        subtotal: params.amount,
        gstAmount: Math.round(gstAmount * 100) / 100,
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        igst: Math.round(igst * 100) / 100,
        total: Math.round((params.amount + gstAmount) * 100) / 100,
        ruleId: matchedRule.id,
        ruleName: matchedRule.rule_name,
        rate: matchedRule.gst_rate,
        isInterState
    };
}
//# sourceMappingURL=gst-calculator.js.map