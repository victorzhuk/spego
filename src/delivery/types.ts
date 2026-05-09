export interface DeliveryEpicLink {
  adapterName: string;
  externalId: string;
  title: string;
  status: DeliveryStatus;
  sourcePath: string;
  taskCount?: number;
  tasksDone?: number;
  warnings?: string[];
}

export interface DeliveryTaskSummary {
  adapterName: string;
  externalId: string;
  title: string;
  status: DeliveryItemStatus;
  parentEpicId: string;
  sourcePath: string;
}

export type DeliveryStatus = 'active' | 'completed' | 'planning-incomplete' | 'unknown';
export type DeliveryItemStatus = 'done' | 'pending' | 'unknown';

export interface DeliveryAdapter {
  readonly name: string;
  listEpics(): Promise<DeliveryEpicLink[]>;
  getEpic(externalId: string): Promise<DeliveryEpicLink>;
  listTasks(externalId: string): Promise<DeliveryTaskSummary[]>;
  getTask(externalId: string, taskId: string): Promise<DeliveryTaskSummary>;
}
