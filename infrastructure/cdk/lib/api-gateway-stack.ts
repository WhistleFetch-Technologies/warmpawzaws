/**
 * ============================================================================
 * AWS CDK STACK - API GATEWAY (FIXED)
 * ============================================================================
 * 
 * Defines API Gateway with Lambda integration
 * FIXED: Variable declaration order and duplicates
 * 
 * Date: 2026-01-02
 * ============================================================================
 */

import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ApiGatewayStackProps extends cdk.StackProps {
  apiHandler: lambda.Function;
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    // Create REST API
    this.api = new apigateway.RestApi(this, 'WarmpawzApi', {
      restApiName: 'Warmpawz API',
      description: 'API Gateway for Warmpawz platform',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      },
    });

    // Create Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(props.apiHandler, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // Add proxy resource for catch-all (must be last)
    // We'll add it at the end after all specific resources

    // =========================================================================
    // DECLARE ALL RESOURCES FIRST (avoid use-before-declaration)
    // =========================================================================
    
    const authResource = this.api.root.addResource('auth');
    const vendorResource = this.api.root.addResource('vendor');
    const vendorIdResource = vendorResource.addResource('{vendorId}');
    const customerResource = this.api.root.addResource('customer');
    const customerIdResource = customerResource.addResource('{customerId}');
    const bookingResource = this.api.root.addResource('bookings');
    const bookingIdResource = bookingResource.addResource('{bookingId}');
    const paymentResource = this.api.root.addResource('payments');
    const configResource = this.api.root.addResource('config');
    const adminResource = this.api.root.addResource('admin');
    const reviewsResource = this.api.root.addResource('reviews');
    const notificationsResource = this.api.root.addResource('notifications');
    const prescriptionsResource = this.api.root.addResource('prescriptions');
    const medicalRecordsResource = this.api.root.addResource('medical-records');
    const productsResource = this.api.root.addResource('products');
    const cartResource = this.api.root.addResource('cart');
    const ordersResource = this.api.root.addResource('orders');
    const analyticsResource = this.api.root.addResource('analytics');
    const loyaltyResource = this.api.root.addResource('loyalty');
    const referralsResource = this.api.root.addResource('referrals');
    const packagesResource = this.api.root.addResource('packages');
    const petsResource = this.api.root.addResource('pets');
    const serviceCatalogResource = this.api.root.addResource('service-catalog');
    const settlementsResource = this.api.root.addResource('settlements');
    const payoutsResource = this.api.root.addResource('payouts');
    const regionsResource = this.api.root.addResource('regions');
    const chatResource = this.api.root.addResource('chat');
    const uploadResource = this.api.root.addResource('upload');
    const subscriptionsResource = this.api.root.addResource('subscriptions');
    const insuranceResource = this.api.root.addResource('insurance');
    const trainingResource = this.api.root.addResource('training');
    const promotionsResource = this.api.root.addResource('promotions');
    const couponsResource = this.api.root.addResource('coupons');
    const eventsResource = this.api.root.addResource('events');
    const healthResource = this.api.root.addResource('health');
    const donationsResource = this.api.root.addResource('donations');
    const logisticsResource = this.api.root.addResource('logistics');
    const returnsResource = this.api.root.addResource('returns');
    const smsResource = this.api.root.addResource('sms');
    const storageResource = this.api.root.addResource('storage');
    const videoCallResource = this.api.root.addResource('video-call');
    const packageSessionResource = this.api.root.addResource('package-sessions');
    const searchResource = this.api.root.addResource('search');
    const staffResource = this.api.root.addResource('staff');
    const razorpayResource = this.api.root.addResource('razorpay');
    const walletResource = this.api.root.addResource('wallet');

    // =========================================================================
    // AUTH ENDPOINTS
    // =========================================================================
    authResource.addMethod('POST', lambdaIntegration);
    authResource.addMethod('GET', lambdaIntegration);

    // =========================================================================
    // VENDOR ENDPOINTS
    // =========================================================================
    vendorResource.addMethod('ANY', lambdaIntegration);
    vendorIdResource.addMethod('GET', lambdaIntegration);
    vendorIdResource.addMethod('PUT', lambdaIntegration);
    
    // Vendor sub-resources
    vendorIdResource.addResource('profile').addMethod('ANY', lambdaIntegration);
    vendorIdResource.addResource('services').addMethod('ANY', lambdaIntegration);
    vendorIdResource.addResource('staff').addMethod('ANY', lambdaIntegration);
    vendorIdResource.addResource('dashboard').addMethod('GET', lambdaIntegration);
    vendorIdResource.addResource('analytics').addMethod('GET', lambdaIntegration);
    vendorIdResource.addResource('bookings').addMethod('GET', lambdaIntegration);
    vendorIdResource.addResource('schedule').addMethod('ANY', lambdaIntegration);
    vendorIdResource.addResource('bank-details').addMethod('ANY', lambdaIntegration);
    vendorIdResource.addResource('tier').addMethod('ANY', lambdaIntegration);

    // =========================================================================
    // CUSTOMER ENDPOINTS
    // =========================================================================
    customerResource.addMethod('ANY', lambdaIntegration);
    customerIdResource.addMethod('GET', lambdaIntegration);
    customerIdResource.addMethod('PUT', lambdaIntegration);
    
    // Customer sub-resources
    customerIdResource.addResource('pets').addMethod('ANY', lambdaIntegration);
    customerIdResource.addResource('addresses').addMethod('ANY', lambdaIntegration);
    customerIdResource.addResource('bookings').addMethod('ANY', lambdaIntegration);
    customerIdResource.addResource('orders').addMethod('GET', lambdaIntegration);
    customerIdResource.addResource('wallet').addMethod('ANY', lambdaIntegration);
    customerIdResource.addResource('preferences').addMethod('ANY', lambdaIntegration);
    customerIdResource.addResource('reminder-preferences').addMethod('ANY', lambdaIntegration);
    customerIdResource.addResource('reminders').addMethod('GET', lambdaIntegration);

    // =========================================================================
    // BOOKING ENDPOINTS
    // =========================================================================
    bookingResource.addMethod('POST', lambdaIntegration);
    bookingResource.addMethod('GET', lambdaIntegration);
    bookingIdResource.addMethod('GET', lambdaIntegration);
    bookingIdResource.addMethod('PUT', lambdaIntegration);
    
    // Booking sub-resources
    bookingIdResource.addResource('status').addMethod('PUT', lambdaIntegration);
    bookingIdResource.addResource('cancel').addMethod('POST', lambdaIntegration);
    bookingIdResource.addResource('confirm').addMethod('POST', lambdaIntegration);
    bookingIdResource.addResource('complete').addMethod('POST', lambdaIntegration);
    bookingIdResource.addResource('generate-otp').addMethod('POST', lambdaIntegration);
    bookingIdResource.addResource('verify-otp').addMethod('POST', lambdaIntegration);
    bookingIdResource.addResource('schedule-reminders').addMethod('POST', lambdaIntegration);
    bookingIdResource.addResource('start-session').addMethod('POST', lambdaIntegration);
    bookingIdResource.addResource('end-session').addMethod('POST', lambdaIntegration);

    // =========================================================================
    // PAYMENT ENDPOINTS
    // =========================================================================
    paymentResource.addMethod('POST', lambdaIntegration);
    paymentResource.addResource('razorpay').addResource('webhook').addMethod('POST', lambdaIntegration);
    paymentResource.addResource('create').addMethod('POST', lambdaIntegration);

    // =========================================================================
    // RAZORPAY ENDPOINTS
    // =========================================================================
    razorpayResource.addMethod('ANY', lambdaIntegration);
    razorpayResource.addResource('create-order').addMethod('POST', lambdaIntegration);
    razorpayResource.addResource('verify-payment').addMethod('POST', lambdaIntegration);
    razorpayResource.addResource('webhook').addMethod('POST', lambdaIntegration);
    razorpayResource.addResource('refund').addMethod('POST', lambdaIntegration);

    // =========================================================================
    // CONFIG ENDPOINTS
    // =========================================================================
    configResource.addResource('roles').addMethod('ANY', lambdaIntegration);

    // =========================================================================
    // ADMIN ENDPOINTS
    // =========================================================================
    adminResource.addMethod('ANY', lambdaIntegration);
    adminResource.addResource('vendors').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('platform').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('roles').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('services').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('promotions').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('coupons').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('tiers').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('tax').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('reviews').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('reports').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('integrations').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('returns').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('vendor-settings').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('transactions').addMethod('ANY', lambdaIntegration);
    adminResource.addResource('regions').addMethod('ANY', lambdaIntegration);

    // =========================================================================
    // OTHER ENDPOINTS (simplified with ANY method for all HTTP verbs)
    // =========================================================================
    reviewsResource.addMethod('ANY', lambdaIntegration);
    notificationsResource.addMethod('ANY', lambdaIntegration);
    prescriptionsResource.addMethod('ANY', lambdaIntegration);
    medicalRecordsResource.addMethod('ANY', lambdaIntegration);
    productsResource.addMethod('ANY', lambdaIntegration);
    cartResource.addMethod('ANY', lambdaIntegration);
    ordersResource.addMethod('ANY', lambdaIntegration);
    analyticsResource.addMethod('ANY', lambdaIntegration);
    loyaltyResource.addMethod('ANY', lambdaIntegration);
    referralsResource.addMethod('ANY', lambdaIntegration);
    packagesResource.addMethod('ANY', lambdaIntegration);
    petsResource.addMethod('ANY', lambdaIntegration);
    serviceCatalogResource.addMethod('ANY', lambdaIntegration);
    settlementsResource.addMethod('ANY', lambdaIntegration);
    payoutsResource.addMethod('ANY', lambdaIntegration);
    regionsResource.addMethod('ANY', lambdaIntegration);
    chatResource.addMethod('ANY', lambdaIntegration);
    uploadResource.addMethod('ANY', lambdaIntegration);
    subscriptionsResource.addMethod('ANY', lambdaIntegration);
    insuranceResource.addMethod('ANY', lambdaIntegration);
    trainingResource.addMethod('ANY', lambdaIntegration);
    promotionsResource.addMethod('ANY', lambdaIntegration);
    couponsResource.addMethod('ANY', lambdaIntegration);
    eventsResource.addMethod('ANY', lambdaIntegration);
    healthResource.addMethod('ANY', lambdaIntegration);
    donationsResource.addMethod('ANY', lambdaIntegration);
    logisticsResource.addMethod('ANY', lambdaIntegration);
    returnsResource.addMethod('ANY', lambdaIntegration);
    smsResource.addMethod('ANY', lambdaIntegration);
    storageResource.addMethod('ANY', lambdaIntegration);
    videoCallResource.addMethod('ANY', lambdaIntegration);
    packageSessionResource.addMethod('ANY', lambdaIntegration);
    searchResource.addMethod('ANY', lambdaIntegration);
    staffResource.addMethod('ANY', lambdaIntegration);
    walletResource.addMethod('ANY', lambdaIntegration);

    // =========================================================================
    // CATCH-ALL PROXY (must be last)
    // =========================================================================
    this.api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true,
    });

    // Output API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });
  }
}
