## MODIFIED Requirements

### Requirement: Provide combined OpenSpec and spego workflow guidance
The system SHALL document and expose agent workflow guidance for using OpenSpec change state together with spego artifacts, including delivery-mirror state maintained by the groom workflow.

#### Scenario: Explain ownership boundary
- **WHEN** an agent presents combined OpenSpec and spego workflow guidance
- **THEN** it states that OpenSpec owns change execution and lifecycle state
- **AND** it states that spego owns durable product-thinking artifacts and delivery-mirror state (`epic`, `sprint-plan`) written only by the groom workflow
- **AND** it states that the spego delivery adapter is read-only

#### Scenario: Recommend combined workflow lanes
- **WHEN** documentation describes combined OpenSpec and spego usage
- **THEN** it groups guidance into before-implementation, during-implementation, and after-implementation lanes
- **AND** each lane includes at least one OpenSpec action and one spego artifact action
- **AND** the before-implementation lane includes grooming the delivery mirror
