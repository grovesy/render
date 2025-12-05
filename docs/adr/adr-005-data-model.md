# ADR-005: Domain Data Model Structure

## Status
Proposed

## Context
We need to standardize how we structure our JSON Schema files and the relationships between different domain entities.

## Decision
Adopt a hierarchical domain-based structure with explicit relationship modeling.

```mermaid
classDiagram
    class Account {
        +String id
        +String accountNumber
        +AccountType type
        +Balance balance
        +Date openedDate
        +getBalance()
        +deposit(amount)
        +withdraw(amount)
    }
    
    class AccountHolder {
        +String id
        +String name
        +Contact contact
        +List~Account~ accounts
        +addAccount(account)
    }
    
    class Transaction {
        +String id
        +String accountId
        +Amount amount
        +Date timestamp
        +TransactionType type
        +execute()
    }
    
    class Card {
        +String cardNumber
        +String accountId
        +CardType type
        +Date expiryDate
        +activate()
        +deactivate()
    }
    
    AccountHolder "1" --> "*" Account : owns
    Account "1" --> "*" Transaction : has
    Account "1" --> "*" Card : linked to
    Transaction --> Account : debits/credits
```

## Schema Organization

```mermaid
graph LR
    A[account.org.biz] --> B[account]
    A --> C[bank]
    A --> D[card]
    
    E[contact.org.biz] --> F[contact]
    E --> G[address]
    E --> H[kyc]
    
    B --> F
    D --> B
    
    style A fill:#e3f2fd
    style E fill:#f3e5f5
```

## Consequences

### Positive
- Clear domain boundaries
- Explicit relationships
- Easier to understand data flow
- Better code organization

### Negative
- More files to manage
- Need tooling to visualize relationships
- Potential for circular dependencies

## Migration Path
1. Create new domain directories
2. Move existing schemas
3. Add relationship metadata
4. Update graph builder
