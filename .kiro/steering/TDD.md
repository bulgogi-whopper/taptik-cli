---
inclusion: always
---

# TDD & Tidy First - AI Development Principles

AI development guidelines based on Kent Beck's Test-Driven Development and Tidy First principles.

## Overview

A systematic approach to ensure quality and maintainability in AI development. Through TDD's step-by-step thinking and Tidy First's incremental improvement philosophy, we achieve safe and predictable code changes.

**Core Philosophy**: "Small steps safely, confidence through tests, continuous improvement"

## TDD Principles (Test-Driven Development)

### Red-Green-Refactor Cycle

**AI Application Principle**: All code changes must strictly follow these 3 phases.

#### 1. Red Phase (Write Failing Test)

```yaml
purpose: Clearly define the feature to implement
ai_behavior:
  - Express feature requirements as tests
  - Intentionally write failing tests
  - Verify tests fail for the right reason

validation_criteria:
  - Does the test fail for the expected reason?
  - Does the test accurately represent the feature to implement?
  - Is the test clear and readable?
```

#### 2. Green Phase (Minimal Implementation)

```yaml
purpose: Write minimal code to pass the test
ai_behavior:
  - Pass tests with the simplest possible method
  - Focus on working code over quality
  - Prohibit excessive design or optimization

validation_criteria:
  - Do all tests pass?
  - Do existing tests still pass?
  - Is the implementation as simple as possible?
```

#### 3. Refactor Phase (Improve)

```yaml
purpose: Improve code quality (without changing behavior)
ai_behavior:
  - Remove duplication
  - Improve clarity
  - Optimize performance
  - Apply design patterns

validation_criteria:
  - Do all tests still pass?
  - Is the code more readable?
  - Is duplication removed?
  - Is the intent clearer?
```

### TDD Core Rules

#### The Three Laws of TDD

1. **Do not write production code without a failing unit test**
2. **Do not write more unit test than sufficient to fail**
3. **Do not write more production code than sufficient to pass the test**

#### AI Execution Strategy

```yaml
code_generation_order: 1. Write test (describe, it, expect) 2. Run test and verify failure 3. Write minimal implementation code 4. Run test and verify pass 5. Refactor (if needed) 6. Run entire test suite

prohibited_actions:
  - Writing code without tests
  - Implementing multiple features at once
  - Refactoring without tests
  - Writing tests that don't fail
```

## Tidy First Principles

### Tidy First (Clean Before Change)

**Core Concept**: Clean code first before making changes to make the change easier.

#### Tidy Behavior Patterns

```yaml
pre_change_cleanup: 1. Read and understand code 2. Identify elements that make change difficult 3. Perform cleanup work (without changing behavior) 4. Verify safety through tests 5. Perform actual change work

cleanup_targets:
  - Long functions → Split into smaller functions
  - Duplicate code → Extract common functions
  - Magic numbers → Named constants
  - Unclear variable names → Intention-revealing names
  - Complex conditionals → Clear functions
```

#### Cleanup Technique Catalog

##### 1. Guard Clauses

```typescript
// Before (needs cleanup)
function processUser(user: User) {
  if (user) {
    if (user.isActive) {
      if (user.permissions.includes('read')) {
        // actual logic
      }
    }
  }
}

// After (cleaned up)
function processUser(user: User) {
  if (!user) return;
  if (!user.isActive) return;
  if (!user.permissions.includes('read')) return;

  // actual logic
}
```

##### 2. Dead Code Elimination

```yaml
identification_criteria:
  - Uncalled functions
  - Unused variables
  - Unreachable code
  - Commented code

removal_procedure: 1. Search for usage 2. Remove from tests 3. Remove from production code 4. Run entire test suite
```

##### 3. Normalize Symmetries

```typescript
// Before (asymmetric)
function handleUserAction(action: string) {
  if (action === 'login') handleLogin();
  else if (action === 'logout') handleLogout();
  else if (action === 'register') handleRegister();
  else handleDefault();
}

// After (symmetric)
function handleUserAction(action: string) {
  const handlers = {
    login: handleLogin,
    logout: handleLogout,
    register: handleRegister,
  };

  const handler = handlers[action] || handleDefault;
  handler();
}
```

### Economics of Software Change

#### Change Cost Minimization Strategy

```yaml
change_cost_factors:
  - Understanding time
  - Test writing time
  - Actual change time
  - Debugging time
  - Deployment and verification time

cost_reduction_methods:
  - Improve code readability
  - Test automation
  - Change in small units
  - Continuous integration
  - Incremental improvement
```

#### Option Value

```yaml
option_creation_strategy:
  - Introduce interfaces for implementation flexibility
  - Use configurable parameters
  - Build plugin architecture
  - Utilize feature flags

option_evaluation_criteria:
  - Future change probability
  - Effort required for change
  - Option maintenance cost
  - Business value
```

## AI Development Workflow

### Feature Development Process

#### 1. Analysis Phase

```yaml
purpose: Decompose requirements into testable units
ai_behavior:
  - Divide features into small units
  - Define input/output for each unit
  - Derive test scenarios
  - Identify dependencies

deliverables:
  - Feature breakdown
  - Test case list
  - Dependency graph
```

#### 2. Design Phase

```yaml
purpose: Design testable structure
ai_behavior:
  - Design interfaces first
  - Identify dependency injection points
  - Establish test double strategy
  - Define module boundaries

deliverables:
  - Interface definitions
  - Module structure diagram
  - Test strategy
```

#### 3. Implementation Phase

```yaml
procedure: 1. Write test (Red) 2. Minimal implementation (Green) 3. Refactor (Refactor) 4. Repeat with next test

validation_points:
  - Run entire test suite each cycle
  - Check code coverage
  - Review code quality metrics
```

### Legacy Code Improvement Process

#### Applying Tidy First

```yaml
improvement_order: 1. Understand current code 2. Clarify change goals 3. Identify elements making change difficult 4. Cleanup work (Tidy) 5. Verify safety through tests 6. Perform actual change work 7. Additional cleanup (if needed)

cleanup_priority:
  - High: Readability, testability
  - Medium: Performance, memory usage
  - Low: Architecture changes
```

#### Safe Refactoring

```yaml
safety_measures:
  - Write tests before changes
  - Change in small units
  - Run tests at each step
  - Prepare to rollback with version control

refactoring_techniques:
  - Extract Method
  - Inline Method
  - Move Method
  - Replace Conditional with Polymorphism
  - Introduce Parameter Object
```

## Quality Assurance Framework

### Test Strategy

#### Test Pyramid

```yaml
unit_tests: # 70%
  - Test individual functions/methods
  - Fast execution (<1ms)
  - Isolated environment
  - High code coverage

integration_tests: # 20%
  - Test module interactions
  - Medium execution speed (<100ms)
  - Use some real dependencies
  - Verify interface contracts

e2e_tests: # 10%
  - Test entire system
  - Slow execution (<10s)
  - Similar to real environment
  - Verify user scenarios
```

#### Test Quality Standards

```yaml
good_test_characteristics:
  - Fast: Quick execution
  - Independent: Independent execution
  - Repeatable: Repeatable
  - Self-Validating: Self-validating
  - Timely: Timely writing

test_naming_convention:
  - Pattern: 'should_[expected_result]_when_[condition]'
  - Example: 'should_return_user_when_valid_id_provided'
  - Descriptive: 'should_throw_error_when_user_not_found'
```

### Continuous Improvement

#### Metrics-Based Improvement

```yaml
quality_metrics:
  - Code coverage: >80
  - Cyclomatic complexity: <10
  - Code duplication rate: <5%
  - Test execution time: <5 minutes

improvement_triggers:
  - Metric threshold exceeded
  - Bug occurrence rate increase
  - Change cost increase
  - Development speed decrease
```

#### Learning and Adaptation

```yaml
retrospective_cycle:
  - Daily: TDD cycle retrospective
  - Weekly: Code quality review
  - Monthly: Process improvement
  - Quarterly: Architecture review

improvement_areas:
  - Test strategy
  - Refactoring techniques
  - Design patterns
  - Tools and automation
```

## AI Execution Guidelines

### Decision Framework

#### Change Decision Matrix

```yaml
change_evaluation_criteria:
  impact: [low|medium|high]
  complexity: [simple|moderate|complex]
  risk: [safe|caution|risky]

decision_rules:
  - high_impact + complex: Tidy First mandatory
  - risky: Split into smaller steps
  - no_tests: Strict Red-Green-Refactor application
```

#### Priority Principles

```yaml
priority_order: 1. Safety (tests pass) 2. Correctness (meets requirements) 3. Readability (ease of understanding) 4. Performance (only when needed) 5. Beauty (last)
```

### Automation Guidelines

#### Automation Priorities

```yaml
mandatory_automation:
  - Test execution
  - Code formatting
  - Lint checking
  - Coverage measurement

recommended_automation:
  - Dependency updates
  - Security vulnerability scanning
  - Performance benchmarking
  - Documentation generation
```

## Practical Application Examples

### TDD Cycle Example

#### New Feature Implementation

```typescript
// 1. Red: Write failing test
describe('UserService', () => {
  it('should create user when valid data provided', async () => {
    const userData = { name: 'John', email: 'john@example.com' };
    const user = await userService.createUser(userData);

    expect(user.id).toBeDefined();
    expect(user.name).toBe('John');
    expect(user.email).toBe('john@example.com');
  });
});

// 2. Green: Minimal implementation
class UserService {
  async createUser(userData: UserData): Promise<User> {
    return {
      id: '1',
      name: userData.name,
      email: userData.email,
    };
  }
}

// 3. Refactor: Improve
class UserService {
  constructor(private userRepository: UserRepository) {}

  async createUser(userData: UserData): Promise<User> {
    const user = new User(userData);
    return this.userRepository.save(user);
  }
}
```

#### Tidy First Example

```typescript
// Before: Code needing cleanup
function processOrder(order: any) {
  if (order && order.items && order.items.length > 0) {
    let total = 0;
    for (let i = 0; i < order.items.length; i++) {
      if (order.items[i].price && order.items[i].quantity) {
        total += order.items[i].price * order.items[i].quantity;
        if (order.items[i].discount) {
          total -= order.items[i].price * order.items[i].quantity * order.items[i].discount;
        }
      }
    }
    if (order.shipping) {
      total += order.shipping;
    }
    return total;
  }
  return 0;
}

// After: Tidy First applied
function processOrder(order: Order): number {
  if (!isValidOrder(order)) return 0;

  const itemsTotal = calculateItemsTotal(order.items);
  const shippingCost = order.shipping || 0;

  return itemsTotal + shippingCost;
}

function isValidOrder(order: Order): boolean {
  return order && order.items && order.items.length > 0;
}

function calculateItemsTotal(items: OrderItem[]): number {
  return items.reduce((total, item) => {
    if (!isValidItem(item)) return total;

    const itemTotal = calculateItemPrice(item);
    return total + itemTotal;
  }, 0);
}

function isValidItem(item: OrderItem): boolean {
  return item.price && item.quantity;
}

function calculateItemPrice(item: OrderItem): number {
  const basePrice = item.price * item.quantity;
  const discount = item.discount || 0;

  return basePrice * (1 - discount);
}
```

## Implementation Checklist

### Before Starting Development

- [ ] Requirements broken down into testable units
- [ ] Test scenarios identified
- [ ] Dependencies mapped
- [ ] Interface contracts defined

### During Development

- [ ] Write failing test first
- [ ] Implement minimal code to pass
- [ ] Run all tests after each change
- [ ] Refactor when tests are green
- [ ] Keep cycles short (< 10 minutes)

### Before Committing

- [ ] All tests pass
- [ ] Code coverage meets threshold
- [ ] No code duplication
- [ ] Clear and expressive code
- [ ] No commented-out code

### Continuous Practices

- [ ] Regular retrospectives
- [ ] Metric monitoring
- [ ] Process refinement
- [ ] Tool improvement
- [ ] Knowledge sharing

This guideline helps AI generate high-quality code in a consistent and predictable manner.
