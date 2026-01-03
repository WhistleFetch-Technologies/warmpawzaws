#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const warmpawz_stack_1 = require("../lib/warmpawz-stack");
const app = new cdk.App();
// Get environment from context or default to dev
const environment = app.node.tryGetContext('environment') || process.env.ENVIRONMENT || 'dev';
// Deploy stacks for each environment
const environments = ['dev', 'test', 'prod'];
environments.forEach((env) => {
    // Use new stack name for dev to avoid DELETE_FAILED state conflict
    const stackName = env === 'dev' ? `WarmpawzStack-${env}-v2` : `WarmpawzStack-${env}`;
    new warmpawz_stack_1.WarmpawzStack(app, `WarmpawzStack-${env}`, {
        stackName: stackName,
        env: {
            account: process.env.CDK_DEFAULT_ACCOUNT || '023394150666',
            region: process.env.CDK_DEFAULT_REGION || 'ap-south-1',
        },
        environment: env,
        description: `Warmpawz Platform AWS Infrastructure - ${env.toUpperCase()} Environment`,
        tags: {
            Project: 'Warmpawz',
            Environment: env,
            ManagedBy: 'CDK',
        },
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2RrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQywwREFBc0Q7QUFFdEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsaURBQWlEO0FBQ2pELE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQztBQUU5RixxQ0FBcUM7QUFDckMsTUFBTSxZQUFZLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBRTdDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtJQUMzQixtRUFBbUU7SUFDbkUsTUFBTSxTQUFTLEdBQUcsR0FBRyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsR0FBRyxFQUFFLENBQUM7SUFDckYsSUFBSSw4QkFBYSxDQUFDLEdBQUcsRUFBRSxpQkFBaUIsR0FBRyxFQUFFLEVBQUU7UUFDN0MsU0FBUyxFQUFFLFNBQVM7UUFDcEIsR0FBRyxFQUFFO1lBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLElBQUksY0FBYztZQUMxRCxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxZQUFZO1NBQ3ZEO1FBQ0QsV0FBVyxFQUFFLEdBQUc7UUFDaEIsV0FBVyxFQUFFLDBDQUEwQyxHQUFHLENBQUMsV0FBVyxFQUFFLGNBQWM7UUFDdEYsSUFBSSxFQUFFO1lBQ0osT0FBTyxFQUFFLFVBQVU7WUFDbkIsV0FBVyxFQUFFLEdBQUc7WUFDaEIsU0FBUyxFQUFFLEtBQUs7U0FDakI7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBXYXJtcGF3elN0YWNrIH0gZnJvbSAnLi4vbGliL3dhcm1wYXd6LXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8gR2V0IGVudmlyb25tZW50IGZyb20gY29udGV4dCBvciBkZWZhdWx0IHRvIGRldlxuY29uc3QgZW52aXJvbm1lbnQgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdlbnZpcm9ubWVudCcpIHx8IHByb2Nlc3MuZW52LkVOVklST05NRU5UIHx8ICdkZXYnO1xuXG4vLyBEZXBsb3kgc3RhY2tzIGZvciBlYWNoIGVudmlyb25tZW50XG5jb25zdCBlbnZpcm9ubWVudHMgPSBbJ2RldicsICd0ZXN0JywgJ3Byb2QnXTtcblxuZW52aXJvbm1lbnRzLmZvckVhY2goKGVudikgPT4ge1xuICAvLyBVc2UgbmV3IHN0YWNrIG5hbWUgZm9yIGRldiB0byBhdm9pZCBERUxFVEVfRkFJTEVEIHN0YXRlIGNvbmZsaWN0XG4gIGNvbnN0IHN0YWNrTmFtZSA9IGVudiA9PT0gJ2RldicgPyBgV2FybXBhd3pTdGFjay0ke2Vudn0tdjJgIDogYFdhcm1wYXd6U3RhY2stJHtlbnZ9YDtcbiAgbmV3IFdhcm1wYXd6U3RhY2soYXBwLCBgV2FybXBhd3pTdGFjay0ke2Vudn1gLCB7XG4gICAgc3RhY2tOYW1lOiBzdGFja05hbWUsXG4gICAgZW52OiB7XG4gICAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5UIHx8ICcwMjMzOTQxNTA2NjYnLFxuICAgICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ2FwLXNvdXRoLTEnLFxuICAgIH0sXG4gICAgZW52aXJvbm1lbnQ6IGVudixcbiAgICBkZXNjcmlwdGlvbjogYFdhcm1wYXd6IFBsYXRmb3JtIEFXUyBJbmZyYXN0cnVjdHVyZSAtICR7ZW52LnRvVXBwZXJDYXNlKCl9IEVudmlyb25tZW50YCxcbiAgICB0YWdzOiB7XG4gICAgICBQcm9qZWN0OiAnV2FybXBhd3onLFxuICAgICAgRW52aXJvbm1lbnQ6IGVudixcbiAgICAgIE1hbmFnZWRCeTogJ0NESycsXG4gICAgfSxcbiAgfSk7XG59KTtcblxuIl19