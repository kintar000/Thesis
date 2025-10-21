import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Server, Cpu, HardDrive, Activity, AlertTriangle, CheckCircle,
  XCircle, Settings, RefreshCw, Eye, BarChart3, 
  Search, Filter, Network, TrendingUp, Clock, Shield,
  Zap, Database, Info, Loader2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, 
  Tooltip as RechartsTooltip, PieChart, Pie, Cell, LineChart, Line, Legend, 
  Area, AreaChart, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, Radar 
} from "recharts";
import { cn } from "@/lib/utils";


interface ZabbixSettings {
  zabbixUrl: string;
  zabbixApiToken: string;
  refreshInterval: number;
}

interface ZabbixHost {
  hostid: string;
  host: string;
  name: string;
  status: string;
  available: string;
  availabilityStatus: string;
  ipAddress: string;
  groups: string;
  monitoringEnabled: boolean;
}

interface HostMetrics {
  hostid: string;
  hostname: string;
  cpuUtilization: number;
  memoryUtilization: number;
  diskUsage: number;
  uptime: string;
  status: string;
  networkIn: number;
  networkOut: number;
  ipAddress: string;
}

interface Problem {
  eventid: string;
  name: string;
  severity: number;
  hostname: string;
  acknowledged: string;
  clock: string;
}

export default function ServersMonitoring() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ZabbixSettings>({
    zabbixUrl: "",
    zabbixApiToken: "",
    refreshInterval: 60
  });
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedHostForChart, setSelectedHostForChart] = useState<string>("");

  // Fetch Zabbix settings
  const { data: savedSettings, refetch: refetchSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/zabbix/settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/zabbix/settings");
      const data = await response.json();
      console.log('Loaded Zabbix settings:', data);
      return data;
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (savedSettings && !settingsLoading) {
      console.log('Updating settings state with:', savedSettings);
      const newSettings = {
        zabbixUrl: savedSettings.zabbixUrl || savedSettings.zabbix_url || "",
        zabbixApiToken: savedSettings.zabbixApiToken || savedSettings.zabbix_api_token || "",
        refreshInterval: savedSettings.refreshInterval || savedSettings.refresh_interval || 60
      };
      console.log('Setting new settings state:', newSettings);
      setSettings(newSettings);
    }
  }, [savedSettings, settingsLoading]);

  // Fetch all available hosts
  const { data: availableHosts, isLoading: hostsLoading } = useQuery({
    queryKey: ["/api/zabbix/hosts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/zabbix/hosts");
      return response.json();
    },
    enabled: !!settings.zabbixUrl && !!settings.zabbixApiToken,
    refetchInterval: settings.refreshInterval * 1000,
  });

  // Fetch metrics for selected hosts
  const { data: hostMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/zabbix/metrics", selectedHosts],
    queryFn: async () => {
      if (selectedHosts.length === 0) return [];
      const response = await apiRequest("POST", "/api/zabbix/metrics", {
        hostIds: selectedHosts
      });
      return response.json();
    },
    enabled: selectedHosts.length > 0 && !!settings.zabbixUrl,
    refetchInterval: settings.refreshInterval * 1000,
  });

  // Fetch problems
  const { data: problems } = useQuery({
    queryKey: ["/api/zabbix/problems"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/zabbix/problems");
      return response.json();
    },
    enabled: !!settings.zabbixUrl && !!settings.zabbixApiToken,
    refetchInterval: settings.refreshInterval * 1000,
  });

  // Auto-select all available hosts on initial load
  useEffect(() => {
    if (availableHosts && availableHosts.length > 0 && selectedHosts.length === 0) {
      const availableHostIds = availableHosts
        .filter((h: ZabbixHost) => h.availabilityStatus === 'available')
        .slice(0, 10) // Limit to first 10 for performance
        .map((h: ZabbixHost) => h.hostid);
      setSelectedHosts(availableHostIds);
    }
  }, [availableHosts]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: ZabbixSettings) => {
      console.log('Saving settings:', newSettings);
      const response = await apiRequest("POST", "/api/zabbix/settings", newSettings);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save settings');
      }
      return response.json();
    },
    onSuccess: async (data) => {
      console.log('Settings saved successfully:', data);
      
      // Update local state immediately
      setSettings({
        zabbixUrl: data.zabbixUrl || data.zabbix_url || settings.zabbixUrl,
        zabbixApiToken: data.zabbixApiToken || data.zabbix_api_token || settings.zabbixApiToken,
        refreshInterval: data.refreshInterval || data.refresh_interval || settings.refreshInterval
      });
      
      toast({ title: "Settings saved", description: "Zabbix settings updated successfully" });
      
      // Invalidate all related queries
      await queryClient.invalidateQueries({ queryKey: ["/api/zabbix/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zabbix/hosts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zabbix/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zabbix/problems"] });
      
      // Refetch settings to ensure sync
      await refetchSettings();
      
      setIsSettingsOpen(false);
    },
    onError: (error: any) => {
      console.error('Error saving settings:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to save settings",
        variant: "destructive"
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/zabbix/test-connection", settings);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Connection successful", description: "Successfully connected to Zabbix API" });
      } else {
        toast({ 
          title: "Connection failed", 
          description: data.message || "Failed to connect to Zabbix",
          variant: "destructive"
        });
      }
    },
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate(settings);
  };

  const handleTestConnection = () => {
    testConnectionMutation.mutate();
  };

  const toggleHostSelection = (hostId: string) => {
    setSelectedHosts(prev => 
      prev.includes(hostId) 
        ? prev.filter(id => id !== hostId)
        : [...prev, hostId]
    );
  };

  const getSeverityColor = (severity: number) => {
    const colors = {
      0: "bg-gray-500",
      1: "bg-blue-500",
      2: "bg-yellow-500",
      3: "bg-orange-500",
      4: "bg-red-500",
      5: "bg-purple-500"
    };
    return colors[severity as keyof typeof colors] || "bg-gray-500";
  };

  const getSeverityLabel = (severity: number) => {
    const labels = {
      0: "Not classified",
      1: "Information",
      2: "Warning",
      3: "Average",
      4: "High",
      5: "Disaster"
    };
    return labels[severity as keyof typeof labels] || "Unknown";
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available': return 'text-green-600';
      case 'unavailable': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available': return CheckCircle;
      case 'unavailable': return XCircle;
      default: return AlertTriangle;
    }
  };

  // Calculate statistics
  const stats = {
    totalHosts: availableHosts?.length || 0,
    availableHosts: availableHosts?.filter((h: ZabbixHost) => h.availabilityStatus === 'available').length || 0,
    unavailableHosts: availableHosts?.filter((h: ZabbixHost) => h.availabilityStatus === 'unavailable').length || 0,
    unknownHosts: availableHosts?.filter((h: ZabbixHost) => h.availabilityStatus === 'unknown').length || 0,
    totalProblems: problems?.length || 0,
    criticalProblems: problems?.filter((p: Problem) => p.severity >= 4).length || 0,
    avgCpu: hostMetrics?.reduce((acc: number, h: HostMetrics) => acc + h.cpuUtilization, 0) / (hostMetrics?.length || 1) || 0,
    avgMemory: hostMetrics?.reduce((acc: number, h: HostMetrics) => acc + h.memoryUtilization, 0) / (hostMetrics?.length || 1) || 0,
  };

  // Chart data
  const resourceUtilizationData = hostMetrics?.map((host: HostMetrics) => ({
    name: host.hostname.length > 15 ? host.hostname.substring(0, 12) + '...' : host.hostname,
    CPU: parseFloat(host.cpuUtilization.toFixed(1)),
    Memory: parseFloat(host.memoryUtilization.toFixed(1)),
    Disk: parseFloat(host.diskUsage.toFixed(1))
  })) || [];

  const statusDistributionData = [
    { name: 'Available', value: stats.availableHosts, color: '#10b981' },
    { name: 'Unavailable', value: stats.unavailableHosts, color: '#ef4444' },
    { name: 'Unknown', value: stats.unknownHosts, color: '#6b7280' }
  ].filter(item => item.value > 0);

  const problemSeverityData = problems?.reduce((acc: any[], problem: Problem) => {
    const severity = getSeverityLabel(problem.severity);
    const existing = acc.find(item => item.name === severity);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: severity, value: 1 });
    }
    return acc;
  }, []) || [];

  // Individual host chart data
  const selectedHostMetric = hostMetrics?.find((h: HostMetrics) => h.hostid === selectedHostForChart);
  const selectedHostInfo = availableHosts?.find((h: ZabbixHost) => h.hostid === selectedHostForChart);
  
  const individualHostData = selectedHostMetric ? [
    { name: 'CPU', value: parseFloat(selectedHostMetric.cpuUtilization.toFixed(1)), fill: '#3b82f6' },
    { name: 'Memory', value: parseFloat(selectedHostMetric.memoryUtilization.toFixed(1)), fill: '#10b981' },
    { name: 'Disk', value: parseFloat(selectedHostMetric.diskUsage.toFixed(1)), fill: '#f59e0b' }
  ] : [];

  const COLORS = ['#10b981', '#ef4444', '#6b7280', '#3b82f6', '#f59e0b', '#8b5cf6'];

  // Filter hosts
  const filteredHosts = availableHosts?.filter((host: ZabbixHost) => {
    const matchesSearch = host.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         host.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         host.ipAddress.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || host.availabilityStatus === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  // Filter problems
  const filteredProblems = problems?.filter((problem: Problem) => {
    return severityFilter === "all" || problem.severity.toString() === severityFilter;
  }) || [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Server Infrastructure Monitoring" 
        description="Real-time server performance analytics and health monitoring via Zabbix"
      >
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/zabbix/hosts"] });
              queryClient.invalidateQueries({ queryKey: ["/api/zabbix/metrics"] });
              queryClient.invalidateQueries({ queryKey: ["/api/zabbix/problems"] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Zabbix Configuration</DialogTitle>
                <DialogDescription>
                  Configure your Zabbix monitoring server connection
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Zabbix Server URL</Label>
                  <Input
                    placeholder="http://your-zabbix-server/zabbix"
                    value={settings.zabbixUrl}
                    onChange={(e) => setSettings({ ...settings, zabbixUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Token</Label>
                  <Input
                    type="password"
                    placeholder="Your Zabbix API token"
                    value={settings.zabbixApiToken}
                    onChange={(e) => setSettings({ ...settings, zabbixApiToken: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Refresh Interval (seconds)</Label>
                  <Input
                    type="number"
                    value={settings.refreshInterval}
                    onChange={(e) => setSettings({ ...settings, refreshInterval: parseInt(e.target.value) || 60 })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleTestConnection} variant="outline" className="flex-1">
                    Test Connection
                  </Button>
                  <Button onClick={handleSaveSettings} className="flex-1">
                    Save Settings
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Hosts</p>
                <p className="text-2xl font-bold">{stats.totalHosts}</p>
              </div>
              <Server className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Available</p>
                <p className="text-2xl font-bold text-green-600">{stats.availableHosts}</p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Unavailable</p>
                <p className="text-2xl font-bold text-red-600">{stats.unavailableHosts}</p>
              </div>
              <XCircle className="h-6 w-6 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Unknown</p>
                <p className="text-2xl font-bold text-gray-600">{stats.unknownHosts}</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-gray-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Issues</p>
                <p className="text-2xl font-bold">{stats.totalProblems}</p>
              </div>
              <Activity className="h-6 w-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-600">{stats.criticalProblems}</p>
              </div>
              <Shield className="h-6 w-6 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg CPU</p>
                <p className="text-2xl font-bold">{stats.avgCpu.toFixed(1)}%</p>
              </div>
              <Cpu className="h-6 w-6 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Memory</p>
                <p className="text-2xl font-bold">{stats.avgMemory.toFixed(1)}%</p>
              </div>
              <Database className="h-6 w-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comprehensive Single-Page Dashboard */}
      <div className="space-y-6">
        {/* Host Status & Uptime Overview Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Host Status & Uptime Overview
            </CardTitle>
            <CardDescription>Real-time host availability and uptime status</CardDescription>
          </CardHeader>
          <CardContent>
            {hostMetrics && hostMetrics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {hostMetrics.map((metric: HostMetrics) => {
                  const StatusIcon = metric.status === 'available' ? CheckCircle :
                                    metric.status === 'unavailable' ? XCircle :
                                    AlertTriangle;
                  const statusColor = metric.status === 'available' ? 'text-green-600' :
                                     metric.status === 'unavailable' ? 'text-red-600' :
                                     'text-gray-600';
                  const borderColor = metric.status === 'available' ? 'border-green-200 dark:border-green-800' :
                                     metric.status === 'unavailable' ? 'border-red-200 dark:border-red-800' :
                                     'border-gray-200 dark:border-gray-800';
                  
                  return (
                    <Card key={metric.hostid} className={`hover:shadow-lg transition-all border-2 ${borderColor}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate mb-1" title={metric.hostname}>
                              {metric.hostname}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {metric.ipAddress}
                            </p>
                          </div>
                          <StatusIcon className={`h-6 w-6 flex-shrink-0 ml-2 ${statusColor}`} />
                        </div>
                        
                        <div className="space-y-2 pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Status</span>
                            <Badge 
                              variant={metric.status === 'available' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {metric.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Uptime</span>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium text-sm">
                                {metric.uptime}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No host data available</p>
                  <p className="text-sm">Select hosts to view their status and uptime</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Problems and Host Status Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Problems Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Active Problems & Alerts
                </CardTitle>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="5">Disaster</SelectItem>
                    <SelectItem value="4">High</SelectItem>
                    <SelectItem value="3">Average</SelectItem>
                    <SelectItem value="2">Warning</SelectItem>
                    <SelectItem value="1">Information</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredProblems.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {filteredProblems.map((problem: Problem) => (
                    <div
                      key={problem.eventid}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${getSeverityColor(problem.severity)}`} />
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-medium text-sm break-words">{problem.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Server className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{problem.hostname}</span>
                        </p>
                      </div>
                      <Badge className={`${getSeverityColor(problem.severity)} flex-shrink-0 text-xs`}>
                        {getSeverityLabel(problem.severity)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p className="text-lg font-medium">No Active Problems</p>
                  <p className="text-sm">All systems are operating normally</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Host Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Host Status Distribution
              </CardTitle>
              <CardDescription>Current availability status</CardDescription>
            </CardHeader>
            <CardContent>
              {statusDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={statusDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  No host data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resource Utilization Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Resource Utilization
            </CardTitle>
            <CardDescription>CPU, Memory, and Disk usage across hosts</CardDescription>
          </CardHeader>
          <CardContent>
            {resourceUtilizationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={resourceUtilizationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="CPU" fill="#3b82f6" />
                  <Bar dataKey="Memory" fill="#10b981" />
                  <Bar dataKey="Disk" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No metrics available</p>
                  <p className="text-sm">Configure Zabbix settings to view data</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4 mr-2" />
            Hosts & Metrics
          </TabsTrigger>
          <TabsTrigger value="problems">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Problems {stats.totalProblems > 0 && `(${stats.totalProblems})`}
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* All Hosts Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  All Monitored Hosts
                </CardTitle>
                <div className="flex gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search hosts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[600px] overflow-auto">
                <table className="w-full table-fixed">
                  <thead className="sticky top-0 bg-background z-10">
                    <tr className="border-b bg-muted/50">
                      <th className="w-16 p-3 text-left text-sm font-medium">Monitor</th>
                      <th className="w-1/6 p-3 text-left text-sm font-medium">Host Name</th>
                      <th className="w-1/6 p-3 text-left text-sm font-medium">Technical Name</th>
                      <th className="w-32 p-3 text-left text-sm font-medium">IP Address</th>
                      <th className="w-1/6 p-3 text-left text-sm font-medium">Groups</th>
                      <th className="w-32 p-3 text-left text-sm font-medium">Status</th>
                      <th className="w-32 p-3 text-left text-sm font-medium">Monitoring</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHosts?.map((host: ZabbixHost) => {
                      const StatusIcon = getStatusIcon(host.availabilityStatus);
                      const isMonitored = selectedHosts.includes(host.hostid);
                      return (
                        <tr key={host.hostid} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isMonitored}
                              onChange={() => toggleHostSelection(host.hostid)}
                              className="h-4 w-4"
                            />
                          </td>
                          <td className="p-3 text-sm font-medium truncate" title={host.name}>{host.name}</td>
                          <td className="p-3 text-sm text-muted-foreground truncate" title={host.host}>{host.host}</td>
                          <td className="p-3 text-sm">{host.ipAddress}</td>
                          <td className="p-3 text-sm text-muted-foreground truncate" title={host.groups}>{host.groups}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <StatusIcon className={cn(
                                "h-4 w-4 flex-shrink-0",
                                host.availabilityStatus === 'available' && "text-green-500",
                                host.availabilityStatus === 'unavailable' && "text-red-500",
                                host.availabilityStatus === 'unknown' && "text-gray-500"
                              )} />
                              <span className={cn(
                                "text-xs font-medium capitalize truncate",
                                host.availabilityStatus === 'available' && "text-green-600",
                                host.availabilityStatus === 'unavailable' && "text-red-600",
                                host.availabilityStatus === 'unknown' && "text-gray-600"
                              )}>
                                {host.availabilityStatus}
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant={host.monitoringEnabled ? "default" : "secondary"} className={cn(
                              "text-xs whitespace-nowrap",
                              host.monitoringEnabled ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" : ""
                            )}>
                              {host.monitoringEnabled ? "Monitored" : "Not Monitored"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          {selectedHosts.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Hosts Selected</CardTitle>
                <CardDescription>
                  Please select hosts from the Overview tab to view metrics
                </CardDescription>
              </CardHeader>
            </Card>
          ) : metricsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Resource Utilization</CardTitle>
                    <CardDescription>CPU, Memory, and Disk usage across selected hosts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={resourceUtilizationData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis label={{ value: 'Usage (%)', angle: -90, position: 'insideLeft' }} />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="CPU" fill="#3b82f6" name="CPU %" />
                        <Bar dataKey="Memory" fill="#10b981" name="Memory %" />
                        <Bar dataKey="Disk" fill="#f59e0b" name="Disk %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Host Status Distribution</CardTitle>
                    <CardDescription>Overview of host availability</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statusDistributionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {statusDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Metrics Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Host Metrics</CardTitle>
                  <CardDescription>Real-time performance data for monitored hosts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border max-h-[600px] overflow-auto">
                    <table className="w-full table-fixed">
                      <thead className="sticky top-0 bg-background z-10">
                        <tr className="border-b bg-muted/50">
                          <th className="w-1/6 p-3 text-left text-sm font-medium">Host</th>
                          <th className="w-32 p-3 text-left text-sm font-medium">IP Address</th>
                          <th className="w-1/6 p-3 text-left text-sm font-medium">CPU %</th>
                          <th className="w-1/6 p-3 text-left text-sm font-medium">Memory %</th>
                          <th className="w-1/6 p-3 text-left text-sm font-medium">Disk %</th>
                          <th className="w-24 p-3 text-left text-sm font-medium">Uptime</th>
                          <th className="w-24 p-3 text-left text-sm font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hostMetrics?.map((metric: HostMetrics) => (
                          <tr key={metric.hostid} className="border-b hover:bg-muted/50">
                            <td className="p-3 font-medium text-sm truncate" title={metric.hostname}>{metric.hostname}</td>
                            <td className="p-3 text-sm text-muted-foreground">{metric.ipAddress}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                  <div 
                                    className={cn(
                                      "h-2 rounded-full",
                                      metric.cpuUtilization > 80 ? "bg-red-500" : 
                                      metric.cpuUtilization > 60 ? "bg-yellow-500" : "bg-green-500"
                                    )}
                                    style={{ width: `${Math.min(metric.cpuUtilization, 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm w-12 text-right">{metric.cpuUtilization.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                  <div 
                                    className={cn(
                                      "h-2 rounded-full",
                                      metric.memoryUtilization > 80 ? "bg-red-500" : 
                                      metric.memoryUtilization > 60 ? "bg-yellow-500" : "bg-green-500"
                                    )}
                                    style={{ width: `${Math.min(metric.memoryUtilization, 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm w-12 text-right">{metric.memoryUtilization.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                  <div 
                                    className={cn(
                                      "h-2 rounded-full",
                                      metric.diskUsage > 80 ? "bg-red-500" : 
                                      metric.diskUsage > 60 ? "bg-yellow-500" : "bg-green-500"
                                    )}
                                    style={{ width: `${Math.min(metric.diskUsage, 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm w-12 text-right">{metric.diskUsage.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline">{metric.uptime}</Badge>
                            </td>
                            <td className="p-3">
                              <Badge variant={metric.status === 'available' ? 'default' : 'destructive'}>
                                {metric.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="problems" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Active Problems & Alerts
                </CardTitle>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="5">Disaster</SelectItem>
                    <SelectItem value="4">High</SelectItem>
                    <SelectItem value="3">Average</SelectItem>
                    <SelectItem value="2">Warning</SelectItem>
                    <SelectItem value="1">Information</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredProblems.length > 0 ? (
                <div className="space-y-3">
                  {filteredProblems.map((problem: Problem) => (
                    <div
                      key={problem.eventid}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-3 h-3 rounded-full ${getSeverityColor(problem.severity)}`} />
                        <div className="flex-1">
                          <p className="font-medium">{problem.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Server className="h-3 w-3" />
                            {problem.hostname}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={getSeverityColor(problem.severity)}>
                          {getSeverityLabel(problem.severity)}
                        </Badge>
                        <Badge variant={problem.acknowledged === "1" ? "default" : "secondary"}>
                          {problem.acknowledged === "1" ? "Acknowledged" : "New"}
                        </Badge>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(parseInt(problem.clock) * 1000).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p className="text-lg font-medium">No Active Problems</p>
                  <p className="text-sm">All systems are operating normally</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Zabbix Configuration
              </CardTitle>
              <CardDescription>
                Configure your Zabbix monitoring server connection details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="zabbixUrl">Zabbix Server URL</Label>
                  <Input
                    id="zabbixUrl"
                    placeholder="http://your-zabbix-server/zabbix"
                    value={settings.zabbixUrl}
                    onChange={(e) => setSettings({ ...settings, zabbixUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zabbixApiToken">API Token</Label>
                  <Input
                    id="zabbixApiToken"
                    type="password"
                    placeholder="Your Zabbix API token"
                    value={settings.zabbixApiToken}
                    onChange={(e) => setSettings({ ...settings, zabbixApiToken: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refreshInterval">Refresh Interval (seconds)</Label>
                  <Input
                    id="refreshInterval"
                    type="number"
                    value={settings.refreshInterval}
                    onChange={(e) => setSettings({ ...settings, refreshInterval: parseInt(e.target.value) || 60 })}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleTestConnection} variant="outline" className="flex-1">
                    Test Connection
                  </Button>
                  <Button onClick={handleSaveSettings} className="flex-1">
                    Save Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}