/**
 * ============================================================================
 * WARMPAWZ PLATFORM - CLOUDWATCH MONITORING STACK
 * ============================================================================
 * 
 * Creates:
 * - CloudWatch Dashboard for real-time monitoring
 * - CloudWatch Alarms for critical metrics
 * - SNS topics for alarm notifications
 * - Lambda log insights queries
 * 
 * Usage:
 *   npm run cdk deploy MonitoringStack
 * 
 * ============================================================================
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  apiId: string;
  lambdaFunctions: lambda.IFunction[];
  dbInstance?: rds.IDatabaseInstance;
  environment: 'development' | 'staging' | 'production';
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // ========================================================================
    // SNS TOPIC FOR ALARMS
    // ========================================================================

    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: `Warmpawz ${props.environment} Alarms`,
      topicName: `warmpawz-${props.environment}-alarms`,
    });

    // Add email subscription (update with your team email)
    this.alarmTopic.addSubscription(
      new subscriptions.EmailSubscription('devops@warmpawz.com')
    );

    // Add SMS subscription for critical alerts (optional)
    if (props.environment === 'production') {
      this.alarmTopic.addSubscription(
        new subscriptions.SmsSubscription('+91-XXXXXXXXXX')
      );
    }

    // ========================================================================
    // CLOUDWATCH DASHBOARD
    // ========================================================================

    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `Warmpawz-${props.environment}`,
      periodOverride: cloudwatch.PeriodOverride.AUTO,
    });

    // ========================================================================
    // API GATEWAY METRICS
    // ========================================================================

    const apiRequestsMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: {
        ApiId: props.apiId,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const api4xxMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4XXError',
      dimensionsMap: {
        ApiId: props.apiId,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const api5xxMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      dimensionsMap: {
        ApiId: props.apiId,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const apiLatencyMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: {
        ApiId: props.apiId,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // Add API Gateway widget
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Requests',
        left: [apiRequestsMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Errors',
        left: [api4xxMetric, api5xxMetric],
        width: 12,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Latency (ms)',
        left: [apiLatencyMetric],
        width: 24,
        height: 6,
      })
    );

    // ========================================================================
    // API GATEWAY ALARMS
    // ========================================================================

    // Alarm: High 5XX error rate
    const api5xxAlarm = new cloudwatch.Alarm(this, 'API5xxAlarm', {
      alarmName: `${props.environment}-api-5xx-errors`,
      metric: api5xxMetric,
      threshold: 10,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: '5XX errors exceeded threshold (10 errors in 10 minutes)',
    });
    api5xxAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    // Alarm: High latency
    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'APILatencyAlarm', {
      alarmName: `${props.environment}-api-high-latency`,
      metric: apiLatencyMetric,
      threshold: 1000, // 1 second
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'API latency exceeded 1 second',
    });
    apiLatencyAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    // ========================================================================
    // LAMBDA METRICS
    // ========================================================================

    const lambdaWidgets: cloudwatch.IWidget[] = [];

    props.lambdaFunctions.slice(0, 6).forEach((func) => {
      const invocationsMetric = func.metricInvocations({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      });

      const errorsMetric = func.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      });

      const durationMetric = func.metricDuration({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      });

      const throttlesMetric = func.metricThrottles({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      });

      lambdaWidgets.push(
        new cloudwatch.GraphWidget({
          title: `Lambda: ${func.functionName} - Invocations & Errors`,
          left: [invocationsMetric],
          right: [errorsMetric, throttlesMetric],
          width: 12,
          height: 6,
        })
      );

      // Create alarms for each Lambda
      const errorAlarm = new cloudwatch.Alarm(this, `${func.functionName}ErrorAlarm`, {
        alarmName: `${props.environment}-${func.functionName}-errors`,
        metric: errorsMetric,
        threshold: 5,
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: `${func.functionName} errors exceeded threshold`,
      });
      errorAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

      const throttleAlarm = new cloudwatch.Alarm(this, `${func.functionName}ThrottleAlarm`, {
        alarmName: `${props.environment}-${func.functionName}-throttles`,
        metric: throttlesMetric,
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: `${func.functionName} is being throttled`,
      });
      throttleAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));
    });

    // Add Lambda widgets to dashboard (in rows of 2)
    for (let i = 0; i < lambdaWidgets.length; i += 2) {
      this.dashboard.addWidgets(...lambdaWidgets.slice(i, i + 2));
    }

    // ========================================================================
    // RDS METRICS (if database provided)
    // ========================================================================

    if (props.dbInstance) {
      const dbCpuMetric = props.dbInstance.metricCPUUtilization({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      });

      const dbConnectionsMetric = props.dbInstance.metricDatabaseConnections({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      });

      const dbFreeStorageMetric = props.dbInstance.metricFreeStorageSpace({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      });

      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'RDS - CPU Utilization (%)',
          left: [dbCpuMetric],
          width: 12,
          height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: 'RDS - Database Connections',
          left: [dbConnectionsMetric],
          width: 12,
          height: 6,
        })
      );

      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'RDS - Free Storage Space (bytes)',
          left: [dbFreeStorageMetric],
          width: 24,
          height: 6,
        })
      );

      // RDS Alarms
      const dbCpuAlarm = new cloudwatch.Alarm(this, 'DBCPUAlarm', {
        alarmName: `${props.environment}-rds-high-cpu`,
        metric: dbCpuMetric,
        threshold: 80, // 80% CPU
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: 'RDS CPU utilization exceeded 80%',
      });
      dbCpuAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

      const dbConnectionsAlarm = new cloudwatch.Alarm(this, 'DBConnectionsAlarm', {
        alarmName: `${props.environment}-rds-high-connections`,
        metric: dbConnectionsMetric,
        threshold: 80, // Adjust based on your RDS instance max_connections
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: 'RDS connections exceeded threshold',
      });
      dbConnectionsAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

      const dbStorageAlarm = new cloudwatch.Alarm(this, 'DBStorageAlarm', {
        alarmName: `${props.environment}-rds-low-storage`,
        metric: dbFreeStorageMetric,
        threshold: 10 * 1024 * 1024 * 1024, // 10 GB
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        alarmDescription: 'RDS free storage space below 10GB',
      });
      dbStorageAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));
    }

    // ========================================================================
    // CUSTOM METRICS (Business Metrics)
    // ========================================================================

    const bookingCreatedMetric = new cloudwatch.Metric({
      namespace: 'Warmpawz/Business',
      metricName: 'BookingsCreated',
      statistic: 'Sum',
      period: cdk.Duration.hours(1),
    });

    const paymentSuccessMetric = new cloudwatch.Metric({
      namespace: 'Warmpawz/Business',
      metricName: 'PaymentsSuccessful',
      statistic: 'Sum',
      period: cdk.Duration.hours(1),
    });

    const vendorSignupsMetric = new cloudwatch.Metric({
      namespace: 'Warmpawz/Business',
      metricName: 'VendorSignups',
      statistic: 'Sum',
      period: cdk.Duration.hours(1),
    });

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Business Metrics - Bookings Created (hourly)',
        left: [bookingCreatedMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Business Metrics - Successful Payments (hourly)',
        left: [paymentSuccessMetric],
        width: 12,
        height: 6,
      })
    );

    // ========================================================================
    // LOG INSIGHTS QUERIES
    // ========================================================================

    new logs.QueryDefinition(this, 'ErrorQuery', {
      queryDefinitionName: `${props.environment}-errors`,
      queryString: new logs.QueryString({
        fields: ['@timestamp', '@message', 'level', 'error'],
        filter: 'level = "ERROR"',
        sort: '@timestamp desc',
        limit: 100,
      }),
      logGroups: props.lambdaFunctions.map((f) => f.logGroup),
    });

    new logs.QueryDefinition(this, 'SlowQueriesQuery', {
      queryDefinitionName: `${props.environment}-slow-queries`,
      queryString: new logs.QueryString({
        fields: ['@timestamp', '@message', 'duration'],
        filter: 'duration > 1000',
        sort: 'duration desc',
        limit: 50,
      }),
      logGroups: props.lambdaFunctions.map((f) => f.logGroup),
    });

    // ========================================================================
    // OUTPUTS
    // ========================================================================

    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlarmTopicARN', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
    });
  }
}

