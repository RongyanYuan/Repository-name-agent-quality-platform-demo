import type { Attribution, Dataset, EvolutionRecord, EvolutionState, EvolutionTargetIdentity, Experiment, ExperimentEvaluationSnapshot, GateDecision, ModuleEvolutionBinding, TraceEvaluationModuleCode } from '../domain'
import { automaticModuleRevisionId } from '../reviews'
import { evolutionItemId } from '../taxonomy'
import { governanceObjectForEvolutionItem } from '../governanceTaxonomy'
import { normalizeSkillVersion } from './skillWorkspace'

const prefix='module-path-demo'
const clone=<T,>(value:T):T=>structuredClone(value)
const unique=(values:string[])=>[...new Set(values)]
const objectFor=(module:TraceEvaluationModuleCode)=>module==='MEMORY'?'Memory':module==='REASON'?'Reason':module==='ACT'||module==='TOOL'?'Act':module==='SKILL'?'Skill':undefined

/** Seed-only explicit associations. Unknown or ambiguous sources never gain guessed gates. */
export function enrichModuleEvolutionFixtures(state:EvolutionState):EvolutionState {
  if(state.evolutionRecords?.some(record=>record.id===`evolution-${prefix}-sop-agent`))return state
  const next=clone(state)
  next.moduleEvolutionBindings ??=[];next.evolutionRecords ??=[]
  const targetFor=(finding:EvolutionState['evaluationFindings'][number],variants:EvolutionState['variants']):EvolutionTargetIdentity|undefined=>{
    const attributionId=evolutionItemId(finding.dimensionLabel)
    const object=attributionId ? governanceObjectForEvolutionItem(attributionId):objectFor(finding.moduleCode)
    if(!attributionId || !object || object==='Context')return undefined
    if(object==='Skill'){
      const targets=variants.flatMap(variant=>variant.targets ?? []).filter(target=>evolutionItemId(target.attributionId ?? target.evolutionItemId)===attributionId)
      const tuples=[...new Map(targets.map(target=>[`${target.skillId}@${normalizeSkillVersion(target.skillVersion)}`,target])).values()]
      const pkg=next.tracePackages.find(item=>item.id===finding.packageId)
      const trace=next.traces.find(item=>item.id===finding.traceId)
      if(tuples.length>1 || !tuples.length && pkg?.skillIds.length!==1)return undefined
      const skillId=tuples[0]?.skillId ?? pkg!.skillIds[0]
      const skillVersion=normalizeSkillVersion(tuples[0]?.skillVersion ?? trace?.skillVersion ?? pkg?.skillVersion)
      return skillVersion ? {kind:'SKILL',governanceObject:'Skill',skillId,skillVersion,attributionId}:undefined
    }
    const sourceVersions=unique(variants.filter(variant=>variant.targetModule===object).map(variant=>variant.currentVersion))
    return {kind:'MODULE',governanceObject:object,targetId:`${object.toLowerCase()}-policy`,targetVersion:sourceVersions.length===1?sourceVersions[0]:undefined,attributionId}
  }
  const bindFinding=(finding:EvolutionState['evaluationFindings'][number],explicitAttribution?:Attribution)=>{
    if(['CONTEXT','OUTCOME'].includes(finding.moduleCode))return
    const pkg=next.tracePackages.find(item=>item.id===finding.packageId && item.traceId===finding.traceId)
    const scores=pkg?.moduleScores.filter(score=>score.moduleCode===finding.moduleCode) ?? []
    if(!pkg || scores.length!==1)return
    const score=scores[0]
    const deliveries=next.routingDeliveries.filter(delivery=>delivery.findingId===finding.id && delivery.traceId===finding.traceId)
    const sharedAttrs=next.attributions.filter(attr=>attr.traceId===finding.traceId && evolutionItemId(attr.dimensionLabel ?? attr.dimension)===evolutionItemId(finding.dimensionLabel))
    const attribution=explicitAttribution ?? (sharedAttrs.length===1?sharedAttrs[0]:undefined)
    const recordIds:string[]=[]
    for(const delivery of deliveries.length?deliveries:[undefined]){
      const issueIds=unique([...(delivery?.issueId?[delivery.issueId]:[]),...next.issues.filter(issue=>attribution && issue.attributionId===attribution.id).map(issue=>issue.id)])
      const clusterIds=unique([...(delivery?.issueClusterId?[delivery.issueClusterId]:[]),...next.issueClusters.filter(cluster=>cluster.issueIds.some(id=>issueIds.includes(id))).map(cluster=>cluster.id)])
      const returnedStrategyVariant=delivery?.variantId ?? next.algorithmBadcases.find(item=>item.id===delivery?.algorithmBadcaseId)?.variantId
      const variants=next.variants.filter(variant=>delivery?.label==='策略迭代' ? returnedStrategyVariant===variant.id : variant.sourceIssueIds.some(id=>issueIds.includes(id)) || variant.sourceClusterIds.some(id=>clusterIds.includes(id)) || delivery?.variantId===variant.id)
      const target=targetFor(finding,variants)
      if(!target)continue
      const experiments=next.experiments.filter(experiment=>experiment.variantIds.some(id=>variants.some(variant=>variant.id===id)))
      const id=`evolution-${finding.id}-${delivery?.id ?? 'undistributed'}`
      const record:EvolutionRecord={id,name:`${finding.moduleLabel} · ${finding.dimensionLabel}`,target,origin:'MOCK',sourceFindingIds:[finding.id],sourceAttributionIds:attribution?[attribution.id]:[],sourceIssueIds:issueIds,sourceClusterIds:clusterIds,optimizationMode:attribution?.optimizationMode ?? (finding.selectedOptimizationCondition==='直接优化'?'DIRECT_FIX':finding.selectedOptimizationCondition==='聚类优化'?'CLUSTER_OPTIMIZATION':undefined),triggerRuleId:next.issueClusters.find(cluster=>clusterIds.includes(cluster.id) && cluster.triggerRuleId)?.triggerRuleId,routingDeliveryIds:delivery?[delivery.id]:[],datasetIds:unique([...(delivery?.regressionDatasetId?[delivery.regressionDatasetId]:[]),...experiments.flatMap(experiment=>experiment.datasetIds)]),variantIds:variants.map(variant=>variant.id),singleExperimentIds:experiments.filter(experiment=>experiment.level==='SINGLE_VARIANT').map(experiment=>experiment.id),windowExperimentIds:experiments.filter(experiment=>experiment.level==='WINDOW_COMBINATION').map(experiment=>experiment.id),decisionIds:next.gateDecisions.filter(decision=>experiments.some(experiment=>experiment.id===decision.experimentId)).map(decision=>decision.id),releaseIds:next.releases.filter(release=>experiments.some(experiment=>experiment.id===release.combinationExperimentId) && release.variantIds.some(id=>variants.some(variant=>variant.id===id))).map(release=>release.id),createdAt:finding.createdAt,updatedAt:finding.updatedAt}
      next.evolutionRecords!.push(record);recordIds.push(id)
    }
    const evals=next.processEvals.filter(evaluation=>evaluation.traceId===finding.traceId && score.evidence.observationIds.includes(evaluation.observationId))
    const base:ModuleEvolutionBinding={id:`binding-${finding.id}`,traceId:finding.traceId,packageId:pkg.id,moduleScoreId:score.id,automaticRevisionId:automaticModuleRevisionId(score),findingId:finding.id,attributionRecordId:attribution?.id,evolutionRecordIds:recordIds,origin:'MOCK',createdAt:finding.createdAt}
    next.moduleEvolutionBindings!.push(base)
    if(evals.length===1)next.moduleEvolutionBindings!.push({...base,id:`${base.id}-${evals[0].id}`,processEvaluationId:evals[0].id})
    for(const dimension of pkg.rating?.processDimensions.filter(item=>item.scoreId===score.id) ?? [])next.moduleEvolutionBindings!.push({...base,id:`${base.id}-dimension-${dimension.id ?? dimension.dimension}`,scoreDimensionId:dimension.id ?? dimension.dimension})
  }
  for(const finding of [...state.evaluationFindings])bindFinding(finding)

  // The original PPT query now demonstrates multiple findings on the same scored Skill module.
  const pkg=next.tracePackages.find(item=>item.id==='package-trace-ppt-generate')
  const source=next.cases.find(item=>item.id==='case-ppt-management')
  const skill=pkg?.moduleScores.find(score=>score.moduleCode==='SKILL')
  if(!pkg || !source || !skill)return next
  const at='2026-10-05T02:00:00Z'
  const makeFinding=(key:string,attr:Attribution,code:TraceEvaluationModuleCode)=>{
    const id=`finding-${prefix}-${key}`
    const finding:EvolutionState['evaluationFindings'][number]={id,packageId:pkg.id,batchId:pkg.batchId,caseId:source.id,sessionId:source.sessionId,traceId:pkg.traceId,moduleCode:code,moduleLabel:code==='SKILL'?'skill':code==='MEMORY'?'记忆':code,dimensionCode:evolutionItemId(attr.dimension) ?? '',dimensionLabel:attr.dimension,description:`Mock 明确归因：${attr.dimension}；与原模块评分及根证据关联。`,taxonomyVersion:'v2.0.0',labelSnapshot:attr.dimension,skillCategory:pkg.skillCategory,status:'CONFIRMED',firstFailure:code==='SKILL',derivedFailure:false,evidenceBundle:clone(pkg.moduleScores.find(score=>score.moduleCode===code)?.evidence ?? skill.evidence),routingDecisionIds:[],routingDeliveryIds:[],selectedOptimizationCondition:attr.optimizationMode==='DIRECT_FIX'?'直接优化':'聚类优化',createdAt:at,updatedAt:at}
    next.evaluationFindings.push(finding)
    return finding
  }
  const sopAttr=clone(next.attributions.find(attr=>attr.id==='attribution-skill-recall')!)
  const sopHistorical=makeFinding('sop-history',sopAttr,'SKILL')
  bindFinding(sopHistorical,sopAttr)
  const oldRecord=next.evolutionRecords!.find(record=>record.sourceFindingIds.includes(sopHistorical.id))
  const newAttr:Attribution={...sopAttr,id:`attribution-${prefix}-sop`,dimension:'skill sop错误',confirmed:true,status:'CONFIRMED',source:'HUMAN',optimizationMode:'DIRECT_FIX',routingLabels:['策略迭代','Agent 迭代'],revisions:[],createdAt:at,updatedAt:at}
  next.attributions.push(newAttr)
  const sop=makeFinding('sop',newAttr,'SKILL')
  const issueId=`issue-${prefix}-sop`
  next.issues.push({id:issueId,caseId:source.id,attributionId:newAttr.id,title:'管理层 PPT SOP 确定性修复（Mock）',description:'显式四阶段治理示例，不修改线上Skill。',module:'Skill',dimension:'skill sop错误',evidenceIds:[...skill.evidence.rootEvidenceIds],routingLabels:['策略迭代','Agent 迭代'],optimizationMode:'DIRECT_FIX',responsibilityStatus:'VERIFIED',owner:'Mock Skill 团队',status:'VERIFIED',clusterIds:[],variantIds:[],createdAt:at,updatedAt:'2026-10-07T01:00:00Z'})
  const delivery=(key:string,label:'策略迭代'|'Agent迭代')=>{
    const decisionId=`routing-decision-${prefix}-${key}`,id=`routing-delivery-${prefix}-${key}`
    const policy=next.routingPolicies.find(item=>item.outputLabel===label)!
    next.routingDecisions.push({id:decisionId,findingId:sop.id,packageId:pkg.id,traceId:pkg.traceId,policyId:policy.id,label,destination:label==='策略迭代'?'ALGORITHM_BADCASE':'AGENT_ITERATION',status:'CONFIRMED',reason:'Mock 人工确认独立处理去向。',confirmedBy:'Mock 治理员',confirmedAt:'2026-10-05T03:00:00Z',deliveryIds:[id],createdAt:at,updatedAt:'2026-10-05T03:00:00Z'})
    next.routingDeliveries.push({id,findingId:sop.id,decisionId,packageId:pkg.id,caseId:source.id,traceId:pkg.traceId,label,destination:label==='策略迭代'?'ALGORITHM_BADCASE':'AGENT_ITERATION',status:'ACKNOWLEDGED',owner:label==='策略迭代'?'Mock 算法团队':'Mock Skill 团队',issueId:label==='Agent迭代'?issueId:undefined,deliveredAt:'2026-10-05T03:00:00Z',acknowledgedAt:'2026-10-05T03:30:00Z',createdAt:at,updatedAt:'2026-10-05T03:30:00Z'})
    sop.routingDecisionIds.push(decisionId);sop.routingDeliveryIds.push(id);return id
  }
  const strategyDelivery=delivery('sop-strategy','策略迭代'),agentDelivery=delivery('sop-agent','Agent迭代')
  const target:EvolutionTargetIdentity={kind:'SKILL',governanceObject:'Skill',skillId:'skill-ppt-builder',skillVersion:'2.5.0',attributionId:'skill-sop'}
  const empty={sourceFindingIds:[sop.id],sourceAttributionIds:[newAttr.id],sourceIssueIds:[issueId],sourceClusterIds:[],optimizationMode:'DIRECT_FIX' as const,datasetIds:[],variantIds:[],singleExperimentIds:[],windowExperimentIds:[],decisionIds:[],releaseIds:[],createdAt:at,updatedAt:at,origin:'MOCK' as const,target}
  const strategy:EvolutionRecord={...clone(empty),id:`evolution-${prefix}-sop-strategy`,name:'skill sop错误 · 策略迭代',routingDeliveryIds:[strategyDelivery]}
  const agent:EvolutionRecord={...clone(empty),id:`evolution-${prefix}-sop-agent`,name:'skill sop错误 · Agent 迭代',routingDeliveryIds:[agentDelivery],supersedesRecordId:oldRecord?.id}
  next.evolutionRecords!.push(strategy,agent)
  const processEval=next.processEvals.find(evaluation=>evaluation.traceId===pkg.traceId && skill.evidence.observationIds.includes(evaluation.observationId))
  const binding:ModuleEvolutionBinding={id:`binding-${prefix}-sop`,traceId:pkg.traceId,packageId:pkg.id,moduleScoreId:skill.id,automaticRevisionId:automaticModuleRevisionId(skill),findingId:sop.id,attributionRecordId:newAttr.id,evolutionRecordIds:[strategy.id,agent.id],origin:'MOCK',createdAt:at}
  next.moduleEvolutionBindings!.push(binding)
  if(processEval)next.moduleEvolutionBindings!.push({...binding,id:`${binding.id}-process`,processEvaluationId:processEval.id})
  for(const dimension of pkg.rating?.processDimensions.filter(item=>item.scoreId===skill.id) ?? [])next.moduleEvolutionBindings!.push({...binding,id:`${binding.id}-dimension-${dimension.id ?? dimension.dimension}`,scoreDimensionId:dimension.id ?? dimension.dimension})

  const template=next.experiments.find(experiment=>experiment.id==='experiment-governance-demo-single')!
  const variantId=`variant-${prefix}-sop`,windowId=`window-${prefix}-sop`,singleId=`experiment-${prefix}-single`,windowExpId=`experiment-${prefix}-window`
  const targets=[{skillId:target.skillId,skillVersion:target.skillVersion,attributionId:target.attributionId,evolutionItemId:target.attributionId}]
  next.variants.push({id:variantId,name:'管理层 SOP 修补候选（Mock）',targetModule:'Skill',changeType:'SKILL_CONTENT',changeSummary:'SOP 直接修复示例',changeContent:'只用于演示治理关联，不代表线上脚本已修改。',currentVersion:'ppt-builder-2.5.0',candidateVersion:'ppt-builder-module-path-demo-rc.1',sourceCaseIds:[source.id],sourceIssueIds:[issueId],sourceClusterIds:[],evidenceIds:[...skill.evidence.rootEvidenceIds],status:'WINDOW_VALIDATED',experimentIds:[singleId,windowExpId],targets,createdAt:'2026-10-07T02:00:00Z',updatedAt:'2026-10-09T03:00:00Z'})
  next.issues.find(issue=>issue.id===issueId)!.variantIds=[variantId]
  const purposes=['原始归因集','同类泛化集','相邻及无关回归集','窗口线上数据全集','泛化集合'] as const
  const datasets:Dataset[]=purposes.map((purpose,index)=>({id:`dataset-${prefix}-${index+1}`,name:`SOP ${purpose}A（Mock）`,type:index===0?'ATTRIBUTION':index===2?'REGRESSION':index===3?'WINDOW_ONLINE':'GENERALIZATION',version:'mock-v1',caseIds:[source.id],sampleCount:1,source:'模块明确来源 Mock',scope:'仅对应本轮 SOP 修复',frozen:true,purpose,targets,population:{totalSampleCount:1,localCaseCount:1,externalSampleCount:0,sourceSystem:'本地 Mock',countingRule:'按 Case ID 去重，Trace 成员范围独立保存'},createdAt:'2026-10-06T01:00:00Z',updatedAt:'2026-10-06T01:00:00Z'}))
  const enroll=(dataset:Dataset)=>{
    next.datasetMemberships ??=[]
    next.datasetMemberships.push({id:`membership-${dataset.id}`,datasetId:dataset.id,datasetVersion:dataset.version,caseId:source.id,traceIds:[pkg.traceId],scope:'TRACE',joinedAt:dataset.createdAt,actor:'Mock 数据治理员',origin:'MOCK'})
  }
  next.datasets.push(...datasets);datasets.forEach(enroll);agent.datasetIds=datasets.map(dataset=>dataset.id)
  const snapshot:ExperimentEvaluationSnapshot={capturedAt:'2026-10-07T03:00:00Z',evalAgentVersion:pkg.moduleScores[0].evalAgentVersion,rubricVersion:pkg.moduleScores[0].rubricVersion,artifactIds:[...source.artifactIds],evidenceBundleIds:pkg.moduleScores.map(score=>score.id),tracePackageIds:[pkg.id],moduleEvaluations:clone(pkg.moduleScores),tracePackages:[clone(pkg)],artifacts:clone(next.artifacts.filter(artifact=>artifact.traceId===pkg.traceId)),rootEvidence:clone(next.evidence.filter(evidence=>evidence.traceId===pkg.traceId)),observations:clone(next.observations.filter(observation=>observation.traceId===pkg.traceId)),processEvals:clone(next.processEvals.filter(evaluation=>evaluation.traceId===pkg.traceId)),outcomeEvals:clone(next.outcomeEvals.filter(evaluation=>evaluation.traceId===pkg.traceId))}
  const makeExperiment=(id:string,level:Experiment['level'],selected:Dataset[],startedAt:string,endedAt:string)=>{
    const decisionId=`decision-${id}`
    const experiment:Experiment={...clone(template),id,name:level==='SINGLE_VARIANT'?'SOP 单能力准出（Mock）':'SOP 窗口组合准出（Mock）',level,variantIds:[variantId],windowId,datasetIds:selected.map(dataset=>dataset.id),baselineVersion:'ppt-builder-2.5.0',candidateVersion:'ppt-builder-module-path-demo-rc.1',targets,runIds:[],gateDecisionId:decisionId,createdAt:startedAt,updatedAt:endedAt}
    experiment.configSnapshot={...clone(template.configSnapshot),createdAt:startedAt,repeatCount:3,datasetVersions:selected.map(dataset=>({datasetId:dataset.id,version:dataset.version,versionId:`${dataset.id}@${dataset.version}`,sampleCount:1,caseIds:[source.id]})),evaluationSnapshot:clone(snapshot),windowSnapshot:level==='WINDOW_COMBINATION'?{windowId,candidateVariantIds:[variantId],cutoffAt:'2026-10-08T01:00:00Z',frozenAt:'2026-10-08T02:00:00Z'}:undefined}
    const runTemplate=next.experimentRuns.find(run=>run.experimentId===template.id)!
    for(const arm of ['BASELINE','CANDIDATE'] as const)for(let repetition=1;repetition<=3;repetition++){
      const run={...clone(runTemplate),id:`run-${id}-${arm}-${repetition}`,experimentId:id,caseId:source.id,repetition,arm,status:'COMPLETED' as const,processScore:arm==='BASELINE'?0.27:0.8,outcomeScore:arm==='BASELINE'?0.29:0.9,configHash:`mock-${id}`,configSnapshot:{...clone(experiment.configSnapshot),evaluationSnapshot:undefined},evalSnapshot:clone(snapshot),windowSnapshot:experiment.configSnapshot.windowSnapshot,createdAt:startedAt,updatedAt:endedAt}
      next.experimentRuns.push(run);experiment.runIds.push(run.id)
    }
    experiment.metrics=[{key:'sop',label:'SOP 模块评分（Mock）',category:'LOCAL',baselineMean:0.27,candidateMean:0.8,baselineStdDev:0,candidateStdDev:0,unit:'score',gateStatus:'PENDING'}]
    next.experiments.push(experiment)
    const decision:GateDecision={id:decisionId,experimentId:id,conclusion:'PASS',decisionBasis:'HUMAN_REVIEW',reason:'Mock 人工依据目标改善与回归报告准出；业务阈值未配置，非自动评分门禁。',riskNotes:[...experiment.knownRisks],decidedBy:'Mock 准出委员',decidedAt:endedAt,reportSnapshot:{experimentId:id,variantIds:[variantId],datasetVersions:selected.map(dataset=>({datasetId:dataset.id,version:dataset.version})),metricResults:clone(experiment.metrics),configSnapshot:clone(experiment.configSnapshot),runSnapshots:clone(next.experimentRuns.filter(run=>run.experimentId===id)),failedCaseIds:[...experiment.failedCaseIds],rollbackItems:[...experiment.rollbackItems],knownRisks:[...experiment.knownRisks],evidenceIds:[...skill.evidence.rootEvidenceIds]}}
    next.gateDecisions.push(decision);agent.decisionIds.push(decisionId)
  }
  makeExperiment(singleId,'SINGLE_VARIANT',datasets.slice(0,3),'2026-10-07T03:00:00Z','2026-10-07T06:00:00Z')
  makeExperiment(windowExpId,'WINDOW_COMBINATION',datasets.slice(3),'2026-10-08T03:00:00Z','2026-10-09T03:00:00Z')
  next.windows.push({id:windowId,name:'模块 SOP 独立窗口（Mock）',timeRange:{from:at,to:'2026-10-09T03:00:00Z'},candidateVariantIds:[variantId],singleExperimentIds:[singleId],combinationExperimentId:windowExpId,status:'DECIDED',cutoffAt:'2026-10-08T01:00:00Z',frozenAt:'2026-10-08T02:00:00Z',createdAt:'2026-10-07T07:00:00Z',updatedAt:'2026-10-09T03:00:00Z'})
  const releaseId=`release-${prefix}-pending`
  next.releases.push({id:releaseId,version:'agent-module-path-demo-candidate',windowId,variantIds:[variantId],combinationExperimentId:windowExpId,gateDecisionId:`decision-${windowExpId}`,approvedBy:'Mock 准出委员',status:'PENDING',createdAt:'2026-10-09T03:30:00Z',updatedAt:'2026-10-09T03:30:00Z'})
  agent.variantIds=[variantId];agent.singleExperimentIds=[singleId];agent.windowExperimentIds=[windowExpId];agent.releaseIds=[releaseId];agent.updatedAt='2026-10-09T03:30:00Z'

  const tasteAttr=next.attributions.find(attr=>attr.id==='attribution-style-mismatch')
  if(tasteAttr){
    const taste=makeFinding('taste',tasteAttr,'SKILL');bindFinding(taste,tasteAttr)
    const tasteRecord=next.evolutionRecords!.find(record=>record.sourceFindingIds.includes(taste.id))
    if(tasteRecord){
      tasteRecord.target={kind:'SKILL',governanceObject:'Skill',skillId:'skill-taste-executive',skillVersion:'0.9.0',attributionId:'taste-recall'}
      const clusterId=`cluster-${prefix}-taste`
      const issueIds=next.issues.filter(issue=>issue.attributionId===tasteAttr.id).map(issue=>issue.id)
      next.issueClusters.push({id:clusterId,name:'管理层品味 Skill 0.9.0 召回问题簇（Mock）',description:'独立的品味 Skill 版本相关数据；不复用生产 PPT Builder 的聚类统计。',module:'Skill',dimension:'品味库召回错误',caseIds:[source.id],issueIds,evidenceIds:[...tasteAttr.evidenceIds],variantIds:[],status:'COLLECTING',triggerRuleId:'rule-taste-100',currentCount:37,threshold:100,countingRule:'按 skill-taste-executive 去重的已确认相关 Case：37 条独立外部 Mock 快照。本地 PPT Builder Query 仅作来源溯源样本，未满足该品味 Skill 本地统计口径，不计入这 37 条。',tastePopulation:{skillId:'skill-taste-executive',externalMockConfirmedCaseCount:37,snapshotId:'mock-taste-executive-090-module-path-demo',source:'独立品味 Skill 0.9.0 已确认相关 Case Mock 快照',countedAt:at},createdAt:at,updatedAt:at})
      next.issues=next.issues.map(issue=>issueIds.includes(issue.id)?{...issue,clusterIds:unique([...issue.clusterIds,clusterId])}:issue)
      tasteRecord.sourceClusterIds=[clusterId];tasteRecord.triggerRuleId='rule-taste-100'
      const tasteDataset:Dataset={...clone(datasets[0]),id:`dataset-${prefix}-taste`,name:'品味召回原始归因集A（Mock）',scope:'明确绑定管理层品味 Skill 0.9.0；聚类触发进度尚在积累',frozen:false,targets:[{skillId:'skill-taste-executive',skillVersion:'0.9.0',attributionId:'taste-recall',evolutionItemId:'taste-recall'}]}
      next.datasets.push(tasteDataset);enroll(tasteDataset);tasteRecord.datasetIds=[tasteDataset.id]
    }
  }
  const memoryEvidenceId=`evidence-${prefix}-memory`
  next.evidence.push({id:memoryEvidenceId,caseId:source.id,traceId:pkg.traceId,kind:'USER_FEEDBACK',title:'记忆准确率 · 独立人工归因证据（Mock）',content:'Mock 多轮复核发现召回的用户偏好与本轮要求不一致；这是独立人工归因线索，原自动模块评分保持。',source:'Mock Session 人工复核',createdAt:at,updatedAt:at})
  const memory:Attribution={...clone(newAttr),id:`attribution-${prefix}-memory`,module:'Memory',moduleCode:'MEMORY',dimension:'准确率低',dimensionCode:'memory-accuracy',dimensionLabel:'准确率低',labelSnapshot:'准确率低',evidenceIds:[memoryEvidenceId],optimizationMode:'CLUSTER_OPTIMIZATION',routingLabels:['Agent 迭代']}
  next.attributions.push(memory);const memoryFinding=makeFinding('memory',memory,'MEMORY')
  memoryFinding.evidenceBundle={...memoryFinding.evidenceBundle,rootEvidenceIds:[memoryEvidenceId],observationIds:[],logIds:[],rubricRule:'记忆准确率归因：人工复核多轮用户偏好；具体进化触发条件待配置。'}
  bindFinding(memoryFinding,memory)
  const memoryRecord=next.evolutionRecords!.find(record=>record.sourceFindingIds.includes(memoryFinding.id))!
  const memoryDataset:Dataset={...clone(datasets[0]),id:`dataset-${prefix}-memory`,name:'记忆准确率原始归因集A（Mock）',scope:'记忆目标独立版本；触发门槛待配置',targets:[],frozen:false}
  next.datasets.push(memoryDataset);enroll(memoryDataset);memoryRecord.datasetIds=[memoryDataset.id]
  if(memoryRecord.target.kind==='MODULE')memoryRecord.target.targetVersion='memory-policy-demo-v1'
  next.cases=next.cases.map(item=>item.id!==source.id?item:{...item,attributionIds:unique([...item.attributionIds,newAttr.id,memory.id]),issueIds:unique([...item.issueIds,issueId])})
  return next
}
