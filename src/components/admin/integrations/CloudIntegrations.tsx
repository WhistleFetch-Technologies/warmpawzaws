import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs';
import { useAdminIntegrations } from '../../../hooks/useAdminIntegrations';
import { Cloud, Database, MessageSquare, Search, Map, Loader2, CheckCircle2, AlertCircle, Wifi, Key, Shield, Video, Bot, Brain, Radio, Globe, Server, Zap, Edit3, Save, X, Lock, Mail } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner@2.0.3';
import { Alert, AlertDescription } from '../../ui/alert';

export function CloudIntegrations() {
  const { fetchSettings, saveSettings, loading, testBedrockConnection, testIntegrationConnection } = useAdminIntegrations();
  const [aws, setAws] = useState<any>({
    credentials: { accessKeyId: '', secretAccessKey: '', region: 'ap-south-1' },
    apiGateway: { enabled: false, endpoint: '', apiKey: '' },
    s3: { enabled: false, bucket: '', region: '' },
    sqs: { enabled: false, queueUrl: '', region: '' },
    sns: { enabled: false, topicArn: '', region: '', senderId: 'WARMP-VX', businessListing: 'WARMP-VX' },
    ses: { enabled: false, region: 'ap-south-1', emailSourceAddress: 'noreply@warmpawz.com' },
    chime: { enabled: false, region: '' },
    bedrock: { enabled: false, region: '', bearerToken: '' },
    es: { enabled: false, endpoint: '', region: '' }
  });
  const [googleMaps, setGoogleMaps] = useState<any>({
    enabled: false,
    apiKey: '',
    region: 'IN'
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [testResult, setTestResult] = useState<any>(null);

  // Edit mode protection
  const [isEditMode, setIsEditMode] = useState(false);
  const [savedAws, setSavedAws] = useState<any>(null);
  const [savedGoogleMaps, setSavedGoogleMaps] = useState<any>(null);

  // Detect changes
  const hasAwsChanges = savedAws && JSON.stringify(aws) !== JSON.stringify(savedAws);
  const hasGoogleMapsChanges = savedGoogleMaps && JSON.stringify(googleMaps) !== JSON.stringify(savedGoogleMaps);
  const hasAnyChanges = hasAwsChanges || hasGoogleMapsChanges;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsInitialLoading(true);
    const data = await fetchSettings();
    if (data.success) {
      const awsData = {
        credentials: { accessKeyId: '', secretAccessKey: '', region: 'ap-south-1' },
        apiGateway: { enabled: false, endpoint: '', apiKey: '' },
        s3: { enabled: false, bucket: '', region: '' },
        sqs: { enabled: false, queueUrl: '', region: '' },
        sns: { enabled: false, topicArn: '', region: '' },
        chime: { enabled: false, region: '' },
        bedrock: { enabled: false, region: '', bearerToken: '' },
        es: { enabled: false, endpoint: '', region: '' },
        ...data.settings.aws,
        credentials: { accessKeyId: '', secretAccessKey: '', region: 'ap-south-1', ...(data.settings.aws?.credentials || {}) },
        apiGateway: { enabled: false, endpoint: '', apiKey: '', ...(data.settings.aws?.apiGateway || {}) },
        s3: { enabled: false, bucket: '', region: '', ...(data.settings.aws?.s3 || {}) },
        sqs: { enabled: false, queueUrl: '', region: '', ...(data.settings.aws?.sqs || {}) },
        sns: { enabled: false, topicArn: '', region: '', ...(data.settings.aws?.sns || {}) },
        chime: { enabled: false, region: '', ...(data.settings.aws?.chime || {}) },
        bedrock: { enabled: false, region: '', bearerToken: '', ...(data.settings.aws?.bedrock || {}) },
        es: { enabled: false, endpoint: '', region: '', ...(data.settings.aws?.es || {}) }
      };
      
      const googleMapsData = {
        enabled: false,
        apiKey: '',
        region: 'IN',
        ...(data.settings.googleMaps || {})
      };

      setAws(awsData);
      setGoogleMaps(googleMapsData);
      setSavedAws(JSON.parse(JSON.stringify(awsData)));
      setSavedGoogleMaps(JSON.parse(JSON.stringify(googleMapsData)));
    }
    setIsInitialLoading(false);
    setIsEditMode(false); // Lock after loading
  };

  const handleSaveGoogleMaps = async () => {
    const result = await saveSettings('googleMaps', googleMaps);
    if (result?.success) {
      await loadData(); // Reload to confirm persistence
      toast.success('Google Maps settings saved and verified');
    }
  };

  const handleSaveAws = async () => {
    const result = await saveSettings('aws', aws);
    if (result?.success) {
      await loadData(); // Reload to confirm persistence
      toast.success('AWS settings saved and verified');
    }
  };

  const handleCancelChanges = () => {
    if (savedAws) setAws(JSON.parse(JSON.stringify(savedAws)));
    if (savedGoogleMaps) setGoogleMaps(JSON.parse(JSON.stringify(savedGoogleMaps)));
    setIsEditMode(false);
    toast.info('Changes discarded');
  };

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] space-y-4 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unsaved Changes Warning */}
      {hasAnyChanges && (
        <Alert className="border-orange-200 bg-orange-50 animate-in slide-in-from-top-2 duration-300">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            You have unsaved changes. Please save your settings to persist them.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: GOOGLE MAPS */}
        <div className="lg:col-span-1 space-y-6">
           <Card className="border-t-4 border-t-blue-500 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Map className="h-5 w-5 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg">Google Maps</CardTitle>
                </div>
                <Badge variant={googleMaps.enabled ? "default" : "secondary"} className={googleMaps.enabled ? "bg-blue-600" : ""}>
                  {googleMaps.enabled ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <CardDescription>
                Required for address autocomplete and logistics routing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={googleMaps.enabled} 
                    onCheckedChange={(c) => setGoogleMaps({...googleMaps, enabled: c})} 
                  />
                  <Label>Enable Integration</Label>
                </div>
                {googleMaps.enabled && <Wifi className="w-4 h-4 text-green-500" />}
              </div>

              {googleMaps.enabled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input 
                      type="password"
                      value={googleMaps.apiKey} 
                      onChange={e => setGoogleMaps({...googleMaps, apiKey: e.target.value})} 
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Region Bias</Label>
                    <Input 
                      value={googleMaps.region} 
                      onChange={e => setGoogleMaps({...googleMaps, region: e.target.value})} 
                      placeholder="IN" 
                      maxLength={2}
                      className="uppercase"
                    />
                    <p className="text-xs text-muted-foreground">Two-letter country code (e.g., IN, US)</p>
                  </div>
                  
                  <Button 
                      variant="outline" 
                      size="sm"
                      className="w-full"
                      onClick={async () => {
                          toast.promise(
                              testIntegrationConnection('googleMaps', googleMaps),
                              {
                                  loading: 'Testing Google Maps API...',
                                  success: (data: any) => {
                                      if(data.success) return `Success: ${data.details}`;
                                      throw new Error(data.error);
                                  },
                                  error: (err) => `Connection Failed: ${err.message}`
                              }
                          );
                      }}
                      disabled={loading || !googleMaps.apiKey}
                  >
                      Test API Connection
                  </Button>
                </div>
              )}

              <Button 
                onClick={handleSaveGoogleMaps} 
                disabled={loading} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                 {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Maps Configuration
              </Button>
            </CardContent>
          </Card>

          {/* Status Summary Card */}
          <Card className="bg-slate-900 text-white border-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Map Services</span>
                <span className={googleMaps.enabled ? "text-green-400" : "text-slate-500"}>
                  {googleMaps.enabled ? 'Operational' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Storage (S3)</span>
                <span className={aws.s3.enabled ? "text-green-400" : "text-slate-500"}>
                  {aws.s3.enabled ? 'Connected' : 'Disabled'}
                </span>
              </div>
               <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Search (ES)</span>
                <span className={aws.es.enabled ? "text-green-400" : "text-slate-500"}>
                  {aws.es.enabled ? 'Indexing' : 'Disabled'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: AWS SERVICES */}
        <div className="lg:col-span-2">
          <Card className="border-t-4 border-t-orange-500 shadow-sm h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Cloud className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">AWS Infrastructure</CardTitle>
                  <CardDescription>Serverless architecture configuration for multi-region deployment.</CardDescription>
                </div>
              </div>
              <Button 
                onClick={handleSaveAws} 
                disabled={loading}
                variant="outline"
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Save All AWS Changes
              </Button>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="credentials" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-slate-100 p-1 mb-6">
                  <TabsTrigger value="credentials" className="gap-2">
                    <Shield className="w-4 h-4" /> IAM & Auth
                  </TabsTrigger>
                  <TabsTrigger value="storage" className="gap-2">
                    <Server className="w-4 h-4" /> Storage
                  </TabsTrigger>
                  <TabsTrigger value="communication" className="gap-2">
                    <Video className="w-4 h-4" /> Comm
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="gap-2">
                    <Brain className="w-4 h-4" /> AI
                  </TabsTrigger>
                </TabsList>

                <div className="min-h-[300px]">
                  {/* TAB 1: CREDENTIALS */}
                  <TabsContent value="credentials" className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                         <h3 className="font-semibold text-slate-900">Global IAM Configuration</h3>
                         <p className="text-sm text-slate-600">Single IAM user for backend Lambda services (SNS, SQS, Chime).</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label>AWS Access Key ID</Label>
                        <div className="relative">
                          <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input 
                            className="pl-10 font-mono"
                            type="password" 
                            value={aws.credentials?.accessKeyId || ''} 
                            onChange={e => setAws({...aws, credentials: {...aws.credentials, accessKeyId: e.target.value}})} 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>AWS Secret Access Key</Label>
                        <div className="relative">
                          <Shield className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input 
                            className="pl-10 font-mono"
                            type="password" 
                            value={aws.credentials?.secretAccessKey || ''} 
                            onChange={e => setAws({...aws, credentials: {...aws.credentials, secretAccessKey: e.target.value}})} 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Default Region</Label>
                        <Input 
                          value={aws.credentials?.region || 'ap-south-1'} 
                          onChange={e => setAws({...aws, credentials: {...aws.credentials, region: e.target.value}})} 
                          placeholder="ap-south-1"
                        />
                      </div>
                      <div className="pt-2">
                          <Button 
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                  toast.promise(
                                      testIntegrationConnection('s3', {
                                          ...aws.credentials,
                                          bucket: aws.s3?.bucket // Optional, but might be useful later
                                      }),
                                      {
                                          loading: 'Verifying AWS Credentials Format...',
                                          success: (data: any) => {
                                              if(data.success) return `Valid: ${data.message}`;
                                              throw new Error(data.error);
                                          },
                                          error: (err) => `Verification Failed: ${err.message}`
                                      }
                                  )
                              }}
                              disabled={loading || !aws.credentials?.accessKeyId}
                          >
                              Verify Credentials Format
                          </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100 mt-6">
                      <div>
                         <h3 className="font-semibold text-blue-900">API Gateway</h3>
                         <p className="text-sm text-blue-700">Secure entry point for frontend applications.</p>
                      </div>
                      <Switch 
                        checked={aws.apiGateway?.enabled} 
                        onCheckedChange={(c) => setAws({...aws, apiGateway: {...aws.apiGateway, enabled: c}})} 
                      />
                    </div>
                    {aws.apiGateway?.enabled && (
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                           <Label>API Gateway Endpoint</Label>
                           <Input value={aws.apiGateway?.endpoint || ''} onChange={e => setAws({...aws, apiGateway: {...aws.apiGateway, endpoint: e.target.value}})} placeholder="https://api.warmpawz.com" />
                        </div>
                        <div className="space-y-2">
                           <Label>Frontend API Key (x-api-key)</Label>
                           <Input type="password" value={aws.apiGateway?.apiKey || ''} onChange={e => setAws({...aws, apiGateway: {...aws.apiGateway, apiKey: e.target.value}})} />
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* TAB 2: STORAGE & QUEUE */}
                  <TabsContent value="storage" className="space-y-6 animate-in fade-in duration-300">
                    {/* S3 */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-100">
                        <div className="flex items-center gap-3">
                           <Database className="w-5 h-5 text-orange-600" />
                           <div>
                             <h3 className="font-semibold text-orange-900">S3 Storage</h3>
                             <p className="text-sm text-orange-700">Presigned URL uploads for media.</p>
                           </div>
                        </div>
                        <Switch 
                          checked={aws.s3.enabled} 
                          onCheckedChange={(c) => setAws({...aws, s3: {...aws.s3, enabled: c}})} 
                        />
                      </div>
                      {aws.s3.enabled && (
                        <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-orange-100">
                          <div className="space-y-2">
                            <Label>Bucket Name</Label>
                            <Input value={aws.s3?.bucket || ''} onChange={e => setAws({...aws, s3: {...aws.s3, bucket: e.target.value}})} placeholder="warmpawz-media-prod" />
                          </div>
                          <div className="space-y-2">
                            <Label>Region</Label>
                            <Input value={aws.s3?.region || ''} onChange={e => setAws({...aws, s3: {...aws.s3, region: e.target.value}})} placeholder="ap-south-1" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SQS */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-100">
                        <div className="flex items-center gap-3">
                           <MessageSquare className="w-5 h-5 text-purple-600" />
                           <div>
                             <h3 className="font-semibold text-purple-900">SQS Queue</h3>
                             <p className="text-sm text-purple-700">Background job processing.</p>
                           </div>
                        </div>
                        <Switch 
                          checked={aws.sqs.enabled} 
                          onCheckedChange={(c) => setAws({...aws, sqs: {...aws.sqs, enabled: c}})} 
                        />
                      </div>
                      {aws.sqs.enabled && (
                        <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-purple-100">
                          <div className="space-y-2">
                            <Label>Queue URL</Label>
                            <Input value={aws.sqs?.queueUrl || ''} onChange={e => setAws({...aws, sqs: {...aws.sqs, queueUrl: e.target.value}})} className="font-mono" />
                          </div>
                          <div className="space-y-2">
                            <Label>Region</Label>
                            <Input value={aws.sqs?.region || ''} onChange={e => setAws({...aws, sqs: {...aws.sqs, region: e.target.value}})} placeholder="ap-south-1" />
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* TAB 3: COMMUNICATION */}
                  <TabsContent value="communication" className="space-y-6 animate-in fade-in duration-300">
                    {/* SNS */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-pink-50 rounded-lg border border-pink-100">
                        <div className="flex items-center gap-3">
                           <Wifi className="w-5 h-5 text-pink-600" />
                           <div>
                             <h3 className="font-semibold text-pink-900">SNS Notifications</h3>
                             <p className="text-sm text-pink-700">OTP and SMS notifications.</p>
                           </div>
                        </div>
                        <Switch 
                          checked={aws.sns.enabled} 
                          onCheckedChange={(c) => setAws({...aws, sns: {...aws.sns, enabled: c}})} 
                        />
                      </div>
                      {aws.sns.enabled && (
                        <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-pink-100">
                          <div className="space-y-2">
                            <Label>Topic ARN</Label>
                            <Input value={aws.sns?.topicArn || ''} onChange={e => setAws({...aws, sns: {...aws.sns, topicArn: e.target.value}})} className="font-mono" />
                          </div>
                          <div className="space-y-2">
                            <Label>Region</Label>
                            <Input value={aws.sns?.region || ''} onChange={e => setAws({...aws, sns: {...aws.sns, region: e.target.value}})} placeholder="ap-south-1" />
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label>Sender ID / Business Listing</Label>
                            <Input 
                              value={aws.sns?.senderId || aws.sns?.businessListing || 'WARMP-VX'} 
                              onChange={e => setAws({...aws, sns: {...aws.sns, senderId: e.target.value, businessListing: e.target.value}})} 
                              placeholder="WARMP-VX" 
                            />
                            <p className="text-xs text-muted-foreground">SMS sender ID (e.g., WARMP-VX, WARMP-SX, WARMP-NX). Must be registered in AWS SNS.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SES */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-3">
                           <Mail className="w-5 h-5 text-blue-600" />
                           <div>
                             <h3 className="font-semibold text-blue-900">SES Email</h3>
                             <p className="text-sm text-blue-700">Email notifications and transactional emails.</p>
                           </div>
                        </div>
                        <Switch 
                          checked={aws.ses?.enabled || false} 
                          onCheckedChange={(c) => setAws({...aws, ses: {...aws.ses, enabled: c}})} 
                        />
                      </div>
                      {aws.ses?.enabled && (
                        <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-blue-100">
                          <div className="space-y-2">
                            <Label>Region</Label>
                            <Input value={aws.ses?.region || ''} onChange={e => setAws({...aws, ses: {...aws.ses, region: e.target.value}})} placeholder="ap-south-1" />
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label>Email Source Address</Label>
                            <Input 
                              value={aws.ses?.emailSourceAddress || 'noreply@warmpawz.com'} 
                              onChange={e => setAws({...aws, ses: {...aws.ses, emailSourceAddress: e.target.value}})} 
                              placeholder="noreply@warmpawz.com" 
                            />
                            <p className="text-xs text-muted-foreground">Verified email address in AWS SES. Must be verified before sending.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CHIME */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="flex items-center gap-3">
                           <Video className="w-5 h-5 text-emerald-600" />
                           <div>
                             <h3 className="font-semibold text-emerald-900">Amazon Chime SDK</h3>
                             <p className="text-sm text-emerald-700">Video consultations and audio calls.</p>
                           </div>
                        </div>
                        <Switch 
                          checked={aws.chime?.enabled} 
                          onCheckedChange={(c) => setAws({...aws, chime: {...aws.chime, enabled: c}})} 
                        />
                      </div>
                      {aws.chime?.enabled && (
                        <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-emerald-100">
                          <div className="space-y-2">
                            <Label>Region</Label>
                            <Input value={aws.chime?.region || ''} onChange={e => setAws({...aws, chime: {...aws.chime, region: e.target.value}})} placeholder="us-east-1" />
                          </div>
                          <div className="col-span-2">
                             <p className="text-xs text-muted-foreground">Note: Chime SDK meetings are created via Lambda using the Global IAM User.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* TAB 4: AI */}
                  <TabsContent value="ai" className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                      <div className="flex items-center gap-3">
                         <Brain className="w-5 h-5 text-indigo-600" />
                         <div>
                           <h3 className="font-semibold text-indigo-900">Bedrock AI</h3>
                           <p className="text-sm text-indigo-700">Symptom checker and intelligent assistants.</p>
                         </div>
                      </div>
                      <Switch 
                        checked={aws.bedrock?.enabled} 
                        onCheckedChange={(c) => setAws({...aws, bedrock: {...aws.bedrock, enabled: c}})} 
                      />
                    </div>

                    {aws.bedrock?.enabled && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Bearer Token (Auth)</Label>
                          <div className="relative">
                            <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                              className="pl-10 font-mono"
                              type="password" 
                              value={aws.bedrock?.bearerToken || ''} 
                              onChange={e => setAws({...aws, bedrock: {...aws.bedrock, bearerToken: e.target.value}})} 
                              placeholder="AWS_BEARER_TOKEN_BEDROCK"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                            <Label>Region</Label>
                            <Input value={aws.bedrock?.region || ''} onChange={e => setAws({...aws, bedrock: {...aws.bedrock, region: e.target.value}})} placeholder="us-east-1" />
                          </div>
                          <div className="space-y-2">
                            <Label>Model ID</Label>
                            <Input value={aws.bedrock?.modelId || ''} onChange={e => setAws({...aws, bedrock: {...aws.bedrock, modelId: e.target.value}})} placeholder="anthropic.claude-v2" />
                          </div>
                        </div>

                         {/* Connection Test */}
                         <div className="pt-4 mt-4 border-t border-indigo-100">
                            <div className="flex items-center justify-between mb-2">
                               <Label className="text-indigo-900 font-semibold flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-indigo-500" />
                                  Connection Diagnostics
                               </Label>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={async () => {
                                  setTestResult(null);
                                  const config = {
                                      credentials: aws.credentials,
                                      region: aws.bedrock?.region,
                                      modelId: aws.bedrock?.modelId,
                                      forceEnable: true
                                  };
                                  const res = await testBedrockConnection(config);
                                  setTestResult(res);
                              }}
                              disabled={loading}
                              className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 bg-white transition-all"
                            >
                              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                              Test Bedrock Connection
                            </Button>
                            
                            {testResult && (
                              <div className={`mt-3 p-3 rounded-md text-xs font-mono overflow-auto max-h-60 shadow-sm border animate-in fade-in slide-in-from-top-1 duration-200 ${testResult.status === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                                  <div className="flex items-center gap-2 mb-2 font-bold">
                                    {testResult.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                    Status: {testResult.status?.toUpperCase()}
                                  </div>
                                  {testResult.message && <div className="mb-2 pb-2 border-b border-black/5">{testResult.message}</div>}
                                  <pre className="text-[10px] opacity-80">{JSON.stringify(testResult, null, 2)}</pre>
                              </div>
                            )}
                         </div>
                      </div>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}