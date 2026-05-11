export interface InputField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  required: boolean;
  description: string;
}

import { BUILTIN_ARTIFACT_TYPES } from '../artifacts/types.js';

export interface CommandMeta {
  name: string;
  description: string;
  slashName: string;
  category: 'workspace' | 'artifact' | 'view' | 'planning';
  inputSchema: Record<string, InputField>;
  outputModes: ('markdown' | 'json')[];
  artifactType?: string;
  artifactTypes?: string[];
}

export const COMMAND_REGISTRY: CommandMeta[] = [
  {
    name: 'init',
    description: 'Initialize a .spego/ workspace in the current project',
    slashName: '/spego:init',
    category: 'workspace',
    inputSchema: {
      agents: { name: 'agents', type: 'string', required: false, description: 'Comma-separated list of agent toolchains' },
      force: { name: 'force', type: 'boolean', required: false, description: 'Overwrite config without deleting artifacts' },
      demo: { name: 'demo', type: 'boolean', required: false, description: 'Seed demo artifacts' },
    },
    outputModes: ['json'],
  },
  {
    name: 'create',
    description: 'Create an artifact',
    slashName: '/spego:create',
    category: 'artifact',
    inputSchema: {
      type: { name: 'type', type: 'string', required: true, description: 'Artifact type, e.g. prd|api|architecture' },
      title: { name: 'title', type: 'string', required: true, description: 'Artifact title' },
      slug: { name: 'slug', type: 'string', required: false, description: 'Optional explicit slug' },
      body: { name: 'body', type: 'string', required: false, description: 'Inline markdown body' },
      bodyFile: { name: 'bodyFile', type: 'string', required: false, description: 'Read markdown body from a file' },
      meta: { name: 'meta', type: 'json', required: false, description: 'JSON object of metadata' },
    },
    outputModes: ['markdown', 'json'],
    artifactTypes: [...BUILTIN_ARTIFACT_TYPES],
  },
  {
    name: 'read',
    description: 'Read an artifact by id or type+slug',
    slashName: '/spego:read',
    category: 'artifact',
    inputSchema: {
      id: { name: 'id', type: 'string', required: false, description: 'Artifact id' },
      type: { name: 'type', type: 'string', required: false, description: 'Artifact type (with --slug)' },
      slug: { name: 'slug', type: 'string', required: false, description: 'Artifact slug (with --type)' },
      path: { name: 'path', type: 'string', required: false, description: 'Read artifact by absolute file path' },
      revision: { name: 'revision', type: 'number', required: false, description: 'Specific revision number' },
    },
    outputModes: ['markdown', 'json'],
    artifactTypes: [...BUILTIN_ARTIFACT_TYPES],
  },
  {
    name: 'update',
    description: 'Update an artifact (requires id)',
    slashName: '/spego:update',
    category: 'artifact',
    inputSchema: {
      id: { name: 'id', type: 'string', required: true, description: 'Artifact id' },
      title: { name: 'title', type: 'string', required: false, description: 'New title' },
      body: { name: 'body', type: 'string', required: false, description: 'New markdown body' },
      bodyFile: { name: 'bodyFile', type: 'string', required: false, description: 'Read body from file' },
      meta: { name: 'meta', type: 'json', required: false, description: 'Replace metadata (JSON object)' },
      expectedRevision: { name: 'expectedRevision', type: 'number', required: false, description: 'Expected current revision (optimistic concurrency)' },
    },
    outputModes: ['markdown', 'json'],
    artifactTypes: [...BUILTIN_ARTIFACT_TYPES],
  },
  {
    name: 'delete',
    description: 'Soft-delete an artifact',
    slashName: '/spego:delete',
    category: 'artifact',
    inputSchema: {
      id: { name: 'id', type: 'string', required: true, description: 'Artifact id' },
    },
    outputModes: ['markdown', 'json'],
    artifactTypes: [...BUILTIN_ARTIFACT_TYPES],
  },
  {
    name: 'list',
    description: 'List artifacts',
    slashName: '/spego:list',
    category: 'artifact',
    inputSchema: {
      type: { name: 'type', type: 'string', required: false, description: 'Filter by type' },
      includeDeleted: { name: 'includeDeleted', type: 'boolean', required: false, description: 'Include soft-deleted artifacts' },
    },
    outputModes: ['markdown', 'json'],
    artifactTypes: [...BUILTIN_ARTIFACT_TYPES],
  },
  {
    name: 'view',
    description: 'Export artifact bundle as markdown or JSON',
    slashName: '/spego:view',
    category: 'view',
    inputSchema: {
      type: { name: 'type', type: 'string', required: false, description: 'Filter by type' },
      id: { name: 'id', type: 'string', required: false, description: 'Limit to a single artifact' },
      revision: { name: 'revision', type: 'number', required: false, description: 'Specific revision (requires --id)' },
      includeDeleted: { name: 'includeDeleted', type: 'boolean', required: false, description: 'Include soft-deleted artifacts' },
      format: { name: 'format', type: 'string', required: false, description: 'Output format: markdown | json' },
    },
    outputModes: ['markdown', 'json'],
  },
  {
    name: 'status',
    description: 'Report workspace status',
    slashName: '/spego:status',
    category: 'workspace',
    inputSchema: {},
    outputModes: ['markdown', 'json'],
  },
  {
    name: 'epics',
    description: 'List epics',
    slashName: '/spego:epics',
    category: 'planning',
    inputSchema: {},
    outputModes: ['markdown', 'json'],
  },
  {
    name: 'tasks',
    description: 'List tasks for a change',
    slashName: '/spego:tasks',
    category: 'planning',
    inputSchema: {
      change: { name: 'change', type: 'string', required: true, description: 'Change or epic name' },
    },
    outputModes: ['markdown', 'json'],
  },
];

export function getCommandByName(name: string): CommandMeta | undefined {
  return COMMAND_REGISTRY.find((c) => c.name === name);
}
