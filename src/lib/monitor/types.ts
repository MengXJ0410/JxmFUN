export type MonitorSensor = {
  label: string;
  celsius: number;
};

export type MonitorContainer = {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  health: string;
  cpuPercent: number;
  memoryUsedBytes: number;
  memoryLimitBytes: number;
  memoryPercent: number;
};

export type MonitorSnapshot = {
  updatedAt: number;
  host: {
    hostname: string;
    kernel: string;
    uptimeSec: number;
    cpu: {
      usagePercent: number;
      cores: number;
      model: string;
      load: [number, number, number];
    };
    memory: {
      totalBytes: number;
      usedBytes: number;
      availableBytes: number;
      percent: number;
    };
    swap: {
      totalBytes: number;
      usedBytes: number;
      percent: number;
    };
    temperature: {
      maxCelsius: number | null;
      sensors: MonitorSensor[];
    };
    disk: {
      mount: string;
      totalBytes: number;
      usedBytes: number;
      freeBytes: number;
      percent: number;
    } | null;
    network: {
      rxBytesPerSec: number;
      txBytesPerSec: number;
      rxTotalBytes: number;
      txTotalBytes: number;
    };
  };
  docker: {
    available: boolean;
    version: string;
    error: string;
    containers: MonitorContainer[];
    counts: {
      total: number;
      running: number;
      stopped: number;
      paused: number;
      unhealthy: number;
    };
  };
};
