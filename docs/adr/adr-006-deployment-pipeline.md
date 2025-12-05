# ADR-006: CI/CD Deployment Pipeline

## Status
Accepted

## Context
We need an automated deployment pipeline that ensures code quality and safe deployments to production.

## Decision
Implement a multi-stage pipeline with automated testing and manual approval gates.

```mermaid
flowchart LR
    A[Git Push] --> B{Branch?}
    B -->|feature| C[Run Tests]
    B -->|main| D[Run Tests]
    
    C --> E{Tests Pass?}
    E -->|Yes| F[Build Preview]
    E -->|No| G[Notify Developer]
    
    D --> H{Tests Pass?}
    H -->|Yes| I[Build Staging]
    H -->|No| G
    
    I --> J[Deploy to Staging]
    J --> K[Smoke Tests]
    K --> L{Manual Approval}
    
    L -->|Approved| M[Deploy to Production]
    L -->|Rejected| N[Rollback]
    
    M --> O[Health Check]
    O --> P{Healthy?}
    P -->|Yes| Q[Complete]
    P -->|No| R[Auto Rollback]
    
    style A fill:#e8f5e9
    style M fill:#fff3e0
    style Q fill:#e1f5fe
    style G fill:#ffebee
    style R fill:#ffebee
```

## Pipeline Stages

1. **Validation**: Lint, type check, unit tests
2. **Build**: Create production bundle
3. **Staging Deploy**: Deploy to staging environment
4. **Integration Tests**: Run full test suite
5. **Manual Gate**: QA approval required
6. **Production Deploy**: Blue-green deployment
7. **Monitoring**: Health checks and metrics

## Consequences

### Positive
- Automated quality checks
- Safe deployments with rollback capability
- Clear deployment process
- Audit trail for all deployments

### Negative
- Longer deployment time
- Requires infrastructure setup
- Manual approval can create bottlenecks

## Rollback Strategy
- Keep last 3 versions deployed
- Instant rollback via load balancer switch
- Database migrations must be backwards compatible
