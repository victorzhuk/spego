## Scope

Existing-service-strict. Manual refresh changes from an artifact read to reconciliation followed by a read. The change is confined to the plugin, its scenarios, and documentation.

## Recovery

If sync fails, attempt one read and keep the diagnostic visible. Recovery never repeats the mutation. CLI writes that completed before a failure remain in the workspace.
