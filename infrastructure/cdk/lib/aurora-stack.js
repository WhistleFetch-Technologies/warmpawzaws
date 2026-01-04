"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuroraStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const constructs_1 = require("constructs");
class AuroraStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // Create database secret
        this.secret = new secretsmanager.Secret(this, 'AuroraSecret', {
            description: 'Aurora RDS database credentials for Warmpawz',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'warmpawz_admin' }),
                generateStringKey: 'password',
                excludeCharacters: '"@/\\',
                passwordLength: 32,
            },
        });
        // Create security group for Aurora
        const auroraSecurityGroup = new ec2.SecurityGroup(this, 'AuroraSecurityGroup', {
            vpc: props.vpc,
            description: 'Security group for Aurora RDS cluster',
            allowAllOutbound: false,
        });
        // Allow inbound from VPC (will be restricted further when Lambda is added)
        auroraSecurityGroup.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(5432), 'Allow PostgreSQL from VPC');
        // Create Aurora Serverless v2 cluster
        // Using VER_15_14 (confirmed available in ap-south-1)
        // Note: 18.1 is not available in ap-south-1 region
        this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
            engine: rds.DatabaseClusterEngine.auroraPostgres({
                version: rds.AuroraPostgresEngineVersion.VER_15_14,
            }),
            credentials: rds.Credentials.fromSecret(this.secret),
            writer: rds.ClusterInstance.serverlessV2('writer'),
            serverlessV2MinCapacity: 0.5,
            serverlessV2MaxCapacity: 16,
            defaultDatabaseName: 'warmpawz',
            vpc: props.vpc,
            vpcSubnets: {
                // Use public subnets (default VPC typically only has public subnets)
                // Security is enforced via security groups
                subnetType: ec2.SubnetType.PUBLIC,
            },
            securityGroups: [auroraSecurityGroup],
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            backup: {
                retention: cdk.Duration.days(7),
                preferredWindow: '03:00-04:00',
            },
            storageEncrypted: true,
            enableDataApi: false, // Use RDS Proxy instead
        });
        // Note: Using VER_17_7 which is available in ap-south-1
        // If 18.1 becomes available, we can override:
        // const cfnCluster = this.cluster.node.defaultChild as rds.CfnDBCluster;
        // cfnCluster.addPropertyOverride('EngineVersion', '18.1');
        // Create RDS Proxy for connection pooling
        this.proxy = new rds.DatabaseProxy(this, 'AuroraProxy', {
            proxyTarget: rds.ProxyTarget.fromCluster(this.cluster),
            secrets: [this.secret],
            vpc: props.vpc,
            securityGroups: [auroraSecurityGroup],
            dbProxyName: 'warmpawz-aurora-proxy',
            requireTLS: true,
            maxConnectionsPercent: 100,
            maxIdleConnectionsPercent: 50,
        });
    }
}
exports.AuroraStack = AuroraStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVyb3JhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXVyb3JhLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsK0VBQWlFO0FBQ2pFLDJDQUF1QztBQU12QyxNQUFhLFdBQVksU0FBUSxzQkFBUztJQUt4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXVCO1FBQy9ELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIseUJBQXlCO1FBQ3pCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDNUQsV0FBVyxFQUFFLDhDQUE4QztZQUMzRCxvQkFBb0IsRUFBRTtnQkFDcEIsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxnQkFBZ0IsRUFBRSxDQUFDO2dCQUNwRSxpQkFBaUIsRUFBRSxVQUFVO2dCQUM3QixpQkFBaUIsRUFBRSxPQUFPO2dCQUMxQixjQUFjLEVBQUUsRUFBRTthQUNuQjtTQUNGLENBQUMsQ0FBQztRQUVILG1DQUFtQztRQUNuQyxNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDN0UsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHO1lBQ2QsV0FBVyxFQUFFLHVDQUF1QztZQUNwRCxnQkFBZ0IsRUFBRSxLQUFLO1NBQ3hCLENBQUMsQ0FBQztRQUVILDJFQUEyRTtRQUMzRSxtQkFBbUIsQ0FBQyxjQUFjLENBQ2hDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQ3JDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUNsQiwyQkFBMkIsQ0FDNUIsQ0FBQztRQUVFLHNDQUFzQztRQUN0QyxzREFBc0Q7UUFDdEQsbURBQW1EO1FBQ25ELElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDNUQsTUFBTSxFQUFFLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLENBQUM7Z0JBQy9DLE9BQU8sRUFBRSxHQUFHLENBQUMsMkJBQTJCLENBQUMsU0FBUzthQUNuRCxDQUFDO1lBQ04sV0FBVyxFQUFFLEdBQUcsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDcEQsTUFBTSxFQUFFLEdBQUcsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztZQUNsRCx1QkFBdUIsRUFBRSxHQUFHO1lBQzVCLHVCQUF1QixFQUFFLEVBQUU7WUFDM0IsbUJBQW1CLEVBQUUsVUFBVTtZQUMvQixHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUc7WUFDZCxVQUFVLEVBQUU7Z0JBQ1YscUVBQXFFO2dCQUNyRSwyQ0FBMkM7Z0JBQzNDLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU07YUFDbEM7WUFDRCxjQUFjLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQztZQUNyQyxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO1lBQ3ZDLE1BQU0sRUFBRTtnQkFDTixTQUFTLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUMvQixlQUFlLEVBQUUsYUFBYTthQUMvQjtZQUNELGdCQUFnQixFQUFFLElBQUk7WUFDdEIsYUFBYSxFQUFFLEtBQUssRUFBRSx3QkFBd0I7U0FDL0MsQ0FBQyxDQUFDO1FBRUMsd0RBQXdEO1FBQ3hELDhDQUE4QztRQUM5Qyx5RUFBeUU7UUFDekUsMkRBQTJEO1FBRS9ELDBDQUEwQztRQUMxQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3RELFdBQVcsRUFBRSxHQUFHLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQ3RELE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDdEIsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHO1lBQ2QsY0FBYyxFQUFFLENBQUMsbUJBQW1CLENBQUM7WUFDckMsV0FBVyxFQUFFLHVCQUF1QjtZQUNwQyxVQUFVLEVBQUUsSUFBSTtZQUNoQixxQkFBcUIsRUFBRSxHQUFHO1lBQzFCLHlCQUF5QixFQUFFLEVBQUU7U0FDOUIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBOUVELGtDQThFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyByZHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJkcyc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXVyb3JhU3RhY2tQcm9wcyB7XG4gIHZwYzogZWMyLklWcGM7XG59XG5cbmV4cG9ydCBjbGFzcyBBdXJvcmFTdGFjayBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBjbHVzdGVyOiByZHMuRGF0YWJhc2VDbHVzdGVyO1xuICBwdWJsaWMgcmVhZG9ubHkgcHJveHk6IHJkcy5EYXRhYmFzZVByb3h5O1xuICBwdWJsaWMgcmVhZG9ubHkgc2VjcmV0OiBzZWNyZXRzbWFuYWdlci5TZWNyZXQ7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEF1cm9yYVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8gQ3JlYXRlIGRhdGFiYXNlIHNlY3JldFxuICAgIHRoaXMuc2VjcmV0ID0gbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCAnQXVyb3JhU2VjcmV0Jywge1xuICAgICAgZGVzY3JpcHRpb246ICdBdXJvcmEgUkRTIGRhdGFiYXNlIGNyZWRlbnRpYWxzIGZvciBXYXJtcGF3eicsXG4gICAgICBnZW5lcmF0ZVNlY3JldFN0cmluZzoge1xuICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoeyB1c2VybmFtZTogJ3dhcm1wYXd6X2FkbWluJyB9KSxcbiAgICAgICAgZ2VuZXJhdGVTdHJpbmdLZXk6ICdwYXNzd29yZCcsXG4gICAgICAgIGV4Y2x1ZGVDaGFyYWN0ZXJzOiAnXCJAL1xcXFwnLFxuICAgICAgICBwYXNzd29yZExlbmd0aDogMzIsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIHNlY3VyaXR5IGdyb3VwIGZvciBBdXJvcmFcbiAgICBjb25zdCBhdXJvcmFTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdBdXJvcmFTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjOiBwcm9wcy52cGMsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBBdXJvcmEgUkRTIGNsdXN0ZXInLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBpbmJvdW5kIGZyb20gVlBDICh3aWxsIGJlIHJlc3RyaWN0ZWQgZnVydGhlciB3aGVuIExhbWJkYSBpcyBhZGRlZClcbiAgICBhdXJvcmFTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuaXB2NChwcm9wcy52cGMudnBjQ2lkckJsb2NrKSxcbiAgICAgIGVjMi5Qb3J0LnRjcCg1NDMyKSxcbiAgICAgICdBbGxvdyBQb3N0Z3JlU1FMIGZyb20gVlBDJ1xuICAgICk7XG5cbiAgICAgICAgLy8gQ3JlYXRlIEF1cm9yYSBTZXJ2ZXJsZXNzIHYyIGNsdXN0ZXJcbiAgICAgICAgLy8gVXNpbmcgVkVSXzE1XzE0IChjb25maXJtZWQgYXZhaWxhYmxlIGluIGFwLXNvdXRoLTEpXG4gICAgICAgIC8vIE5vdGU6IDE4LjEgaXMgbm90IGF2YWlsYWJsZSBpbiBhcC1zb3V0aC0xIHJlZ2lvblxuICAgICAgICB0aGlzLmNsdXN0ZXIgPSBuZXcgcmRzLkRhdGFiYXNlQ2x1c3Rlcih0aGlzLCAnQXVyb3JhQ2x1c3RlcicsIHtcbiAgICAgICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUNsdXN0ZXJFbmdpbmUuYXVyb3JhUG9zdGdyZXMoe1xuICAgICAgICAgICAgdmVyc2lvbjogcmRzLkF1cm9yYVBvc3RncmVzRW5naW5lVmVyc2lvbi5WRVJfMTVfMTQsXG4gICAgICAgICAgfSksXG4gICAgICBjcmVkZW50aWFsczogcmRzLkNyZWRlbnRpYWxzLmZyb21TZWNyZXQodGhpcy5zZWNyZXQpLFxuICAgICAgd3JpdGVyOiByZHMuQ2x1c3Rlckluc3RhbmNlLnNlcnZlcmxlc3NWMignd3JpdGVyJyksXG4gICAgICBzZXJ2ZXJsZXNzVjJNaW5DYXBhY2l0eTogMC41LFxuICAgICAgc2VydmVybGVzc1YyTWF4Q2FwYWNpdHk6IDE2LFxuICAgICAgZGVmYXVsdERhdGFiYXNlTmFtZTogJ3dhcm1wYXd6JyxcbiAgICAgIHZwYzogcHJvcHMudnBjLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICAvLyBVc2UgcHVibGljIHN1Ym5ldHMgKGRlZmF1bHQgVlBDIHR5cGljYWxseSBvbmx5IGhhcyBwdWJsaWMgc3VibmV0cylcbiAgICAgICAgLy8gU2VjdXJpdHkgaXMgZW5mb3JjZWQgdmlhIHNlY3VyaXR5IGdyb3Vwc1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFthdXJvcmFTZWN1cml0eUdyb3VwXSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIGJhY2t1cDoge1xuICAgICAgICByZXRlbnRpb246IGNkay5EdXJhdGlvbi5kYXlzKDcpLFxuICAgICAgICBwcmVmZXJyZWRXaW5kb3c6ICcwMzowMC0wNDowMCcsXG4gICAgICB9LFxuICAgICAgc3RvcmFnZUVuY3J5cHRlZDogdHJ1ZSxcbiAgICAgIGVuYWJsZURhdGFBcGk6IGZhbHNlLCAvLyBVc2UgUkRTIFByb3h5IGluc3RlYWRcbiAgICB9KTtcblxuICAgICAgICAvLyBOb3RlOiBVc2luZyBWRVJfMTdfNyB3aGljaCBpcyBhdmFpbGFibGUgaW4gYXAtc291dGgtMVxuICAgICAgICAvLyBJZiAxOC4xIGJlY29tZXMgYXZhaWxhYmxlLCB3ZSBjYW4gb3ZlcnJpZGU6XG4gICAgICAgIC8vIGNvbnN0IGNmbkNsdXN0ZXIgPSB0aGlzLmNsdXN0ZXIubm9kZS5kZWZhdWx0Q2hpbGQgYXMgcmRzLkNmbkRCQ2x1c3RlcjtcbiAgICAgICAgLy8gY2ZuQ2x1c3Rlci5hZGRQcm9wZXJ0eU92ZXJyaWRlKCdFbmdpbmVWZXJzaW9uJywgJzE4LjEnKTtcblxuICAgIC8vIENyZWF0ZSBSRFMgUHJveHkgZm9yIGNvbm5lY3Rpb24gcG9vbGluZ1xuICAgIHRoaXMucHJveHkgPSBuZXcgcmRzLkRhdGFiYXNlUHJveHkodGhpcywgJ0F1cm9yYVByb3h5Jywge1xuICAgICAgcHJveHlUYXJnZXQ6IHJkcy5Qcm94eVRhcmdldC5mcm9tQ2x1c3Rlcih0aGlzLmNsdXN0ZXIpLFxuICAgICAgc2VjcmV0czogW3RoaXMuc2VjcmV0XSxcbiAgICAgIHZwYzogcHJvcHMudnBjLFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFthdXJvcmFTZWN1cml0eUdyb3VwXSxcbiAgICAgIGRiUHJveHlOYW1lOiAnd2FybXBhd3otYXVyb3JhLXByb3h5JyxcbiAgICAgIHJlcXVpcmVUTFM6IHRydWUsXG4gICAgICBtYXhDb25uZWN0aW9uc1BlcmNlbnQ6IDEwMCxcbiAgICAgIG1heElkbGVDb25uZWN0aW9uc1BlcmNlbnQ6IDUwLFxuICAgIH0pO1xuICB9XG59XG5cbiJdfQ==