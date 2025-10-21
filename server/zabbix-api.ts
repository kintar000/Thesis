import type { Express, Request, Response } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";

interface ZabbixSettings {
  zabbixUrl: string;
  zabbixApiToken: string;
  refreshInterval: number;
}

// Zabbix API request helper
async function zabbixApiRequest(settings: ZabbixSettings, method: string, params: any = {}) {
  const response = await fetch(`${settings.zabbixUrl}/api_jsonrpc.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json-rpc',
      'Authorization': `Bearer ${settings.zabbixApiToken}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: 1
    })
  });

  if (!response.ok) {
    throw new Error(`Zabbix API request failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Zabbix API error: ${data.error.data || data.error.message}`);
  }

  return data.result;
}

// Format uptime to human readable
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Parse item value safely
function parseItemValue(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

export function registerZabbixRoutes(app: Express, requireAuth: any) {

  // Get Zabbix settings
  app.get("/api/zabbix/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ message: "Database not available" });
      }

      const result = await db.execute(sql`
        SELECT * FROM zabbix_settings LIMIT 1
      `);

      const settings = result.rows[0] || {
        zabbixUrl: "",
        zabbixApiToken: "",
        refreshInterval: 60
      };

      res.json(settings);
    } catch (error: any) {
      console.error('Error fetching Zabbix settings:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Save Zabbix settings
  app.post("/api/zabbix/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ message: "Database not available" });
      }

      const { zabbixUrl, zabbixApiToken, refreshInterval } = req.body;

      console.log('Saving Zabbix settings:', { zabbixUrl, refreshInterval, hasToken: !!zabbixApiToken });

      // Check if settings exist
      const existing = await db.execute(sql`
        SELECT id FROM zabbix_settings LIMIT 1
      `);

      if (existing.rows.length > 0) {
        await db.execute(sql`
          UPDATE zabbix_settings 
          SET zabbix_url = ${zabbixUrl}
            , zabbix_api_token = ${zabbixApiToken}
            , refresh_interval = ${refreshInterval || 60}
            , updated_at = NOW()
          WHERE id = ${existing.rows[0].id}
        `);
        console.log('Updated existing Zabbix settings');
      } else {
        await db.execute(sql`
          INSERT INTO zabbix_settings (zabbix_url, zabbix_api_token, refresh_interval)
          VALUES (${zabbixUrl}, ${zabbixApiToken}, ${refreshInterval || 60})
        `);
        console.log('Created new Zabbix settings');
      }

      // Return the saved settings in consistent format
      res.json({ 
        message: "Zabbix settings saved successfully",
        zabbixUrl,
        zabbix_url: zabbixUrl,
        zabbixApiToken,
        zabbix_api_token: zabbixApiToken,
        refreshInterval: refreshInterval || 60,
        refresh_interval: refreshInterval || 60
      });
    } catch (error: any) {
      console.error('Error saving Zabbix settings:', error);
      res.status(500).json({ 
        success: false,
        message: `Failed to save settings: ${error.message}` 
      });
    }
  });

  // Test Zabbix connection
  app.post("/api/zabbix/test-connection", requireAuth, async (req: Request, res: Response) => {
    try {
      const { zabbixUrl, zabbixApiToken } = req.body;

      if (!zabbixUrl || !zabbixApiToken) {
        return res.json({ 
          success: false, 
          message: 'Zabbix URL and API Token are required' 
        });
      }

      // Ensure URL ends with /api_jsonrpc.php
      const apiUrl = zabbixUrl.endsWith('/api_jsonrpc.php') 
        ? zabbixUrl 
        : `${zabbixUrl.replace(/\/$/, '')}/api_jsonrpc.php`;

      console.log('Testing Zabbix connection to:', apiUrl);

      // Test API version endpoint (no auth required)
      const versionResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json-rpc',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'apiinfo.version',
          params: {},
          id: 1
        })
      });

      if (!versionResponse.ok) {
        return res.json({ 
          success: false, 
          message: `HTTP Error: ${versionResponse.status} ${versionResponse.statusText}` 
        });
      }

      const versionData = await versionResponse.json();
      console.log('Zabbix API version response:', versionData);

      if (versionData.error) {
        return res.json({ 
          success: false, 
          message: `API Error: ${versionData.error.data || versionData.error.message}` 
        });
      }

      // Test authentication with the API token
      const authResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json-rpc',
          'Authorization': `Bearer ${zabbixApiToken}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'host.get',
          params: {
            output: ['hostid', 'host'],
            limit: 1
          },
          id: 2
        })
      });

      const authData = await authResponse.json();
      console.log('Zabbix auth test response:', authData);

      if (authData.error) {
        return res.json({ 
          success: false, 
          message: `Authentication failed: ${authData.error.data || authData.error.message}. Please check your API token.` 
        });
      }

      res.json({ 
        success: true, 
        message: `Successfully connected to Zabbix ${versionData.result}` 
      });
    } catch (error: any) {
      console.error('Error testing Zabbix connection:', error);
      res.json({ 
        success: false, 
        message: `Connection failed: ${error.message}` 
      });
    }
  });

  // Get all hosts
  app.get("/api/zabbix/hosts", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ message: "Database not available" });
      }

      const settingsResult = await db.execute(sql`
        SELECT * FROM zabbix_settings LIMIT 1
      `);

      if (!settingsResult.rows[0]) {
        return res.status(400).json({ message: "Zabbix not configured" });
      }

      const settings = settingsResult.rows[0];

      // Access the correct column names from the database
      const zabbixUrl = settings.zabbix_url || settings.zabbixUrl;
      const zabbixApiToken = settings.zabbix_api_token || settings.zabbixApiToken;

      // Check if settings exist and have required fields
      if (!settings || !zabbixUrl || !zabbixApiToken) {
        return res.status(400).json({ message: "Zabbix not configured. Please configure Zabbix settings first." });
      }

      // Ensure URL ends with /api_jsonrpc.php
      let apiUrl = zabbixUrl;
      if (!apiUrl.endsWith('/api_jsonrpc.php')) {
        apiUrl = `${apiUrl.replace(/\/$/, '')}/api_jsonrpc.php`;
      }
      const baseUrl = apiUrl.replace('/api_jsonrpc.php', '');

      // Get all hosts with detailed information including interface availability
      const hosts = await zabbixApiRequest(
        {
          zabbixUrl: baseUrl,
          zabbixApiToken: zabbixApiToken,
          refreshInterval: settings.refresh_interval || settings.refreshInterval || 60
        },
        'host.get',
        {
          output: ['hostid', 'host', 'name', 'status', 'available', 'description', 'error', 'errors_from', 'disable_until'],
          selectInterfaces: ['interfaceid', 'ip', 'type', 'main', 'useip', 'available', 'error', 'details'],
          selectGroups: ['groupid', 'name'],
          limitSelects: 5
        }
      );

      // Enrich host data with better availability status for Zabbix 7.4
      const enrichedHosts = hosts.map((host: any) => {
        // Check interface availability first, then host available field
        let availabilityStatus = 'unknown';

        // Try to get status from main interface
        const mainInterface = host.interfaces?.find((i: any) => parseInt(i.main) === 1);
        
        // Debug logging for troubleshooting
        console.log(`Host ${host.name} (${host.hostid}):`, {
          hostStatus: host.status,
          hostAvailable: host.available,
          interfaceAvailable: mainInterface?.available,
          hasError: !!host.error,
          errorMsg: host.error
        });
        
        // Zabbix 7.4 availability values:
        // 0 = unknown, 1 = available, 2 = unavailable
        
        // Priority 1: Check main interface availability (most reliable)
        if (mainInterface && mainInterface.available !== undefined && mainInterface.available !== null && mainInterface.available !== '') {
          const ifaceAvailable = parseInt(mainInterface.available);
          if (ifaceAvailable === 1) {
            availabilityStatus = 'available';
          } else if (ifaceAvailable === 2) {
            availabilityStatus = 'unavailable';
          } else {
            availabilityStatus = 'unknown';
          }
        } 
        // Priority 2: Check host-level availability
        else if (host.available !== undefined && host.available !== null && host.available !== '') {
          const available = parseInt(host.available);
          if (available === 1) {
            availabilityStatus = 'available';
          } else if (available === 2) {
            availabilityStatus = 'unavailable';
          } else {
            availabilityStatus = 'unknown';
          }
        } 
        // Priority 3: If host is disabled, mark as unavailable
        else if (parseInt(host.status) === 1) {
          availabilityStatus = 'unavailable';
        } 
        // Priority 4: Default to unknown if no clear status
        else {
          availabilityStatus = 'unknown';
        }

        return {
          ...host,
          ipAddress: mainInterface?.ip || 'N/A',
          groups: host.groups?.map((g: any) => g.name).join(', ') || 'None',
          availabilityStatus,
          monitoringEnabled: parseInt(host.status) === 0
        };
      });

      res.json(enrichedHosts);
    } catch (error: any) {
      console.error('Error fetching hosts:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get metrics for selected hosts
  app.post("/api/zabbix/metrics", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ message: "Database not available" });
      }

      const { hostIds } = req.body;

      const settingsResult = await db.execute(sql`
        SELECT * FROM zabbix_settings LIMIT 1
      `);

      if (!settingsResult.rows[0]) {
        return res.status(400).json({ message: "Zabbix not configured" });
      }

      const settings = settingsResult.rows[0];

      // Ensure URL is properly formatted
      let apiUrl = settings.zabbix_url;
      if (!apiUrl.endsWith('/api_jsonrpc.php')) {
        apiUrl = `${apiUrl.replace(/\/$/, '')}/api_jsonrpc.php`;
      }
      const baseUrl = apiUrl.replace('/api_jsonrpc.php', '');

      const metrics = [];

      for (const hostId of hostIds) {
        // Get host info with interfaces including availability
        const hostInfo = await zabbixApiRequest(
          {
            zabbixUrl: baseUrl,
            zabbixApiToken: settings.zabbix_api_token,
            refreshInterval: settings.refresh_interval
          },
          'host.get',
          {
            hostids: [hostId],
            output: ['hostid', 'host', 'name', 'available', 'status', 'error'],
            selectInterfaces: ['ip', 'available', 'main', 'type', 'error']
          }
        );

        if (!hostInfo || hostInfo.length === 0) continue;

        const host = hostInfo[0];

        // Get all items for this host
        const allItems = await zabbixApiRequest(
          {
            zabbixUrl: baseUrl,
            zabbixApiToken: settings.zabbix_api_token,
            refreshInterval: settings.refresh_interval
          },
          'item.get',
          {
            hostids: [hostId],
            output: ['itemid', 'key_', 'lastvalue', 'name', 'units'],
            monitored: true,
            sortfield: 'name'
          }
        );

        // Find relevant metrics with fallbacks
        const cpuItem = allItems.find((item: any) => 
          item.key_.includes('cpu.util') || 
          item.key_.includes('system.cpu') ||
          item.name.toLowerCase().includes('cpu')
        );

        const memItem = allItems.find((item: any) => 
          item.key_.includes('memory.util') || 
          item.key_.includes('vm.memory') ||
          item.name.toLowerCase().includes('memory utilization')
        );

        const diskItem = allItems.find((item: any) => 
          item.key_.includes('fs.pused') || 
          item.key_.includes('disk') ||
          item.name.toLowerCase().includes('disk space')
        );

        const uptimeItem = allItems.find((item: any) => 
          item.key_.includes('system.uptime') || 
          item.key_.includes('uptime') ||
          item.name.toLowerCase().includes('uptime')
        );

        // Get network traffic
        const netInItem = allItems.find((item: any) => 
          item.key_.includes('net.if.in') || 
          item.name.toLowerCase().includes('incoming')
        );

        const netOutItem = allItems.find((item: any) => 
          item.key_.includes('net.if.out') || 
          item.name.toLowerCase().includes('outgoing')
        );

        // Calculate uptime
        let uptimeValue = "N/A";
        if (uptimeItem && uptimeItem.lastvalue) {
          const uptimeSeconds = parseFloat(uptimeItem.lastvalue);
          if (!isNaN(uptimeSeconds)) {
            uptimeValue = formatUptime(uptimeSeconds);
          }
        }

        // Determine status using same logic as hosts endpoint
        let metricStatus = 'unknown';
        const mainInterface = host.interfaces?.[0];
        
        if (mainInterface && mainInterface.available !== undefined && mainInterface.available !== null && mainInterface.available !== '') {
          const ifaceAvailable = parseInt(mainInterface.available);
          if (ifaceAvailable === 1) {
            metricStatus = 'available';
          } else if (ifaceAvailable === 2) {
            metricStatus = 'unavailable';
          } else {
            metricStatus = 'unknown';
          }
        } else if (host.available !== undefined && host.available !== null && host.available !== '') {
          const available = parseInt(host.available);
          if (available === 1) {
            metricStatus = 'available';
          } else if (available === 2) {
            metricStatus = 'unavailable';
          } else {
            metricStatus = 'unknown';
          }
        } else if (parseInt(host.status) === 1) {
          metricStatus = 'unavailable';
        }

        metrics.push({
          hostid: hostId,
          hostname: host.name,
          host: host.host,
          ipAddress: host.interfaces?.[0]?.ip || 'N/A',
          cpuUtilization: parseItemValue(cpuItem?.lastvalue),
          memoryUtilization: parseItemValue(memItem?.lastvalue),
          diskUsage: parseItemValue(diskItem?.lastvalue),
          uptime: uptimeValue,
          networkIn: parseItemValue(netInItem?.lastvalue),
          networkOut: parseItemValue(netOutItem?.lastvalue),
          status: metricStatus,
          monitoringStatus: host.status === "0" ? "monitored" : "not monitored"
        });
      }

      res.json(metrics);
    } catch (error: any) {
      console.error('Error fetching metrics:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get current problems
  app.get("/api/zabbix/problems", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ message: "Database not available" });
      }

      const settingsResult = await db.execute(sql`
        SELECT * FROM zabbix_settings LIMIT 1
      `);

      if (!settingsResult.rows[0]) {
        return res.status(400).json({ message: "Zabbix not configured" });
      }

      const settings = settingsResult.rows[0];

      // Ensure URL is properly formatted
      let apiUrl = settings.zabbix_url;
      if (!apiUrl.endsWith('/api_jsonrpc.php')) {
        apiUrl = `${apiUrl.replace(/\/$/, '')}/api_jsonrpc.php`;
      }
      const baseUrl = apiUrl.replace('/api_jsonrpc.php', '');

      // Get problems without selectHosts (compatibility with Zabbix 7.4)
      const problems = await zabbixApiRequest(
        {
          zabbixUrl: baseUrl,
          zabbixApiToken: settings.zabbix_api_token,
          refreshInterval: settings.refresh_interval
        },
        'problem.get',
        {
          output: ['eventid', 'objectid', 'name', 'severity', 'acknowledged', 'clock', 'r_eventid'],
          recent: true,
          sortfield: 'eventid',
          sortorder: 'DESC'
        }
      );

      // Get trigger IDs for batch processing
      const triggerIds = problems.map((p: any) => p.objectid);

      // Fetch all triggers in one request to reduce connections
      let triggerHostMap: { [key: string]: { hostname: string; host: string } } = {};

      if (triggerIds.length > 0) {
        try {
          const triggers = await zabbixApiRequest(
            {
              zabbixUrl: baseUrl,
              zabbixApiToken: settings.zabbix_api_token,
              refreshInterval: settings.refresh_interval
            },
            'trigger.get',
            {
              triggerids: triggerIds,
              output: ['triggerid'],
              selectHosts: ['host', 'name']
            }
          );

          // Build trigger to host mapping
          triggers.forEach((trigger: any) => {
            if (trigger.hosts && trigger.hosts.length > 0) {
              triggerHostMap[trigger.triggerid] = {
                hostname: trigger.hosts[0].name || 'Unknown',
                host: trigger.hosts[0].host || 'Unknown'
              };
            }
          });
        } catch (err) {
          console.error('Error fetching hosts for problems:', err);
        }
      }

      // Map problems with host information
      const formattedProblems = problems.map((problem: any) => {
        const hostInfo = triggerHostMap[problem.objectid] || { hostname: 'Unknown', host: 'Unknown' };

        return {
          eventid: problem.eventid,
          name: problem.name,
          severity: parseInt(problem.severity),
          hostname: hostInfo.hostname,
          host: hostInfo.host,
          acknowledged: problem.acknowledged,
          clock: problem.clock,
          tags: [],
          resolved: problem.r_eventid ? true : false
        };
      });

      res.json(formattedProblems);
    } catch (error: any) {
      console.error('Error fetching problems:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get historical data for charts
  app.post("/api/zabbix/history", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({ message: "Database not available" });
      }

      const { hostId, itemKey, timeFrom } = req.body;

      const settingsResult = await db.execute(sql`
        SELECT * FROM zabbix_settings LIMIT 1
      `);

      if (!settingsResult.rows[0]) {
        return res.status(400).json({ message: "Zabbix not configured" });
      }

      const settings = settingsResult.rows[0];
      let apiUrl = settings.zabbix_url;
      if (!apiUrl.endsWith('/api_jsonrpc.php')) {
        apiUrl = `${apiUrl.replace(/\/$/, '')}/api_jsonrpc.php`;
      }
      const baseUrl = apiUrl.replace('/api_jsonrpc.php', '');

      // Get item ID
      const items = await zabbixApiRequest(
        {
          zabbixUrl: baseUrl,
          zabbixApiToken: settings.zabbix_api_token,
          refreshInterval: settings.refresh_interval
        },
        'item.get',
        {
          hostids: [hostId],
          search: { key_: itemKey },
          output: ['itemid', 'value_type']
        }
      );

      if (!items || items.length === 0) {
        return res.json([]);
      }

      const item = items[0];
      const history = await zabbixApiRequest(
        {
          zabbixUrl: baseUrl,
          zabbixApiToken: settings.zabbix_api_token,
          refreshInterval: settings.refresh_interval
        },
        'history.get',
        {
          itemids: [item.itemid],
          time_from: timeFrom || Math.floor(Date.now() / 1000) - 3600,
          output: 'extend',
          sortfield: 'clock',
          sortorder: 'ASC',
          limit: 100
        }
      );

      res.json(history);
    } catch (error: any) {
      console.error('Error fetching history:', error);
      res.status(500).json({ message: error.message });
    }
  });
}