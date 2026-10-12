## Purpose

精简 Skill 细项页面的职责边界，将数据集、评测、实验和准出集中到统一工作台，避免用户在多个页面重复维护同一条进化链路。

## ADDED Requirements

### Requirement: Skill detail SHALL retain only identity and linked evaluation context
Skill 细项 SHALL 保留 Skill ID、名称、分类、当前版本、候选版本、更新时间和数据集与评测关联入口。

#### Scenario: Open Skill detail
- **WHEN** 用户从数据集与评测工作台点击 Skill
- **THEN** 打开 Skill 基本信息及对应 Skill + 进化项工作台筛选，不重复展示独立治理台账

### Requirement: Skill detail SHALL remove duplicated governance subsections
Skill 细项 SHALL 删除独立的资产、问题与归因、实验与准出、能力变体、发布版本展示与维护入口；这些对象 SHALL 通过统一关联入口访问。

#### Scenario: Verify removed sections
- **WHEN** 用户查看 Skill 细项
- **THEN** 页面不展示上述五类独立区块，并提供指向数据集与评测工作台的统一入口

