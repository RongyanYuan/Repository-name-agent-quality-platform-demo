import { useEffect, useState } from 'react'
import { Braces, ClipboardCheck, Tags } from 'lucide-react'
import type { JudgeStatus, Observation } from '../../domain'
import { formatDuration } from '../../selectors'
import { ObservationDetails, TraceTimeline } from '../../trace'
import { Button, Drawer, EmptyState, Field, Modal, SelectInput, Tabs, TextArea } from '../../ui'
import { ATTRIBUTION_DIMENSIONS, type EvolutionModule } from '../domain'
import { EntityId, IdLink } from '../components/ViewPrimitives'
import { StatusIndicator, statusIndicatorText } from '../components/StatusIndicator'
import { selectLatestTraceState } from '../data/governanceGraph'
import { selectArtifactOutcomeEvaluations } from '../data/artifactOutcomes'
import { EvidenceBundleDrawer } from '../components/EvidenceBundleDrawer'
import { CaseEvaluations, type EvolutionDetailLocation } from './CaseEvaluations'
import { CaseOutcomeEvaluations } from './CaseOutcomeEvaluations'
import { CASE_DETAIL_VIEWS, normalizeCaseView, type CaseDetailView } from './caseViews'
import type { CaseAnalysisData, CaseAnalysisRecord, CaseReference, LogView } from './model'
import type { AttributionChangeInput, HumanConfirmationInput } from './CaseAnalysisWorkbench'
import type { ModuleReviewInput } from '../reviews'
import type { OutcomeReviewInput } from '../outcomeReviews'

export interface CaseDetailPanelProps {
  initialModuleScoreId?: string; initialScoreDimensionId?: string; initialEvolutionRecordId?: string; initialFindingId?: string
  initialEvolutionDirectionId?: string
  sourceRoute?: string; onOpenEvolutionWorkbench?: (href:string)=>void
  onEvolutionDetailChange?: (selection?: EvolutionDetailLocation)=>void
  onEvolutionDirectionChange?: (id?: string)=>void
  record?: CaseAnalysisRecord; data: CaseAnalysisData; onClose: () => void
  initialTraceId?: string; initialObservationId?: string; initialLogId?: string; initialEvidenceId?: string
  initialArtifactId?: string; initialEvaluationId?: string; initialView?: string
  onViewChange?: (view: string) => void; onNavigate?: (ref: CaseReference) => void
  onHumanConfirm?: (input: HumanConfirmationInput) => void | Promise<void>
  onAttributionChange?: (input: AttributionChangeInput) => void | Promise<void>
  onModuleReview?: (input: ModuleReviewInput) => Promise<void>
  onOutcomeReview?: (input: OutcomeReviewInput) => Promise<void>
}
const dateTime = (value: string) => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value)) : '时间未记录'

export function CaseDetailPanel(props: CaseDetailPanelProps) {
  const {record:base,data,onNavigate,onClose}=props
  const [traceId,setTraceId]=useState(props.initialTraceId ?? base?.trace?.id)
  const record=data.traceRecords?.find(item=>item.id===base?.id && item.trace?.id===traceId) ?? base
  const [localTab,setTab]=useState<CaseDetailView>(normalizeCaseView(props.initialView))
  const tab=props.onEvolutionDetailChange ? normalizeCaseView(props.initialView) : localTab
  const [nodeId,setNodeId]=useState(props.initialObservationId)
  const node=record?.trace?.observations.find(item=>item.id===nodeId) ?? record?.failureObservation ?? record?.trace?.observations[0]
  const [nodeOpen,setNodeOpen]=useState(Boolean(props.initialObservationId))
  const [allNodes,setAllNodes]=useState(false)
  const [log,setLog]=useState<LogView|undefined>(record?.logs.find(item=>item.id===props.initialLogId))
  const [evidenceModule,setEvidenceModule]=useState<Record<string,unknown>>()
  const [confirmOpen,setConfirmOpen]=useState(false)
  const [confirmStatus,setConfirmStatus]=useState<JudgeStatus>(record?.outcomeSummary ?? 'UNKNOWN')
  const [confirmNote,setConfirmNote]=useState('')
  const [attrOpen,setAttrOpen]=useState(false)
  const [attrId,setAttrId]=useState(record?.attributions?.[0]?.id ?? '')
  const [module,setModule]=useState(record?.attributionModule ?? 'Skill')
  const [dimension,setDimension]=useState(record?.attributionDimension ?? ATTRIBUTION_DIMENSIONS.Skill[0])
  const [routing,setRouting]=useState(record?.routingTags ?? [])
  const [attrNote,setAttrNote]=useState('')
  const [moduleHistoryId,setModuleHistoryId]=useState<string>()
  const [saveError,setSaveError]=useState('')
  const [saving,setSaving]=useState(false)
  useEffect(()=>setTab(normalizeCaseView(props.initialView)),[props.initialView])
  useEffect(()=>{
    setAttrId(record?.attributions?.[0]?.id ?? '')
    setModule(record?.attributionModule ?? 'Skill')
    setDimension(record?.attributionDimension ?? ATTRIBUTION_DIMENSIONS.Skill[0])
    setRouting(record?.routingTags ?? [])
    setConfirmStatus(record?.outcomeSummary ?? 'UNKNOWN')
    setConfirmNote('');setAttrNote('');setSaveError('');setAttrOpen(false);setConfirmOpen(false);setModuleHistoryId(undefined)
  },[record?.trace?.id])
  useEffect(()=>{
    if(!props.initialEvidenceId || !record)return
    const root=data.rootEvidence?.find(item=>item.id===props.initialEvidenceId)
    const outcomes=data.evolutionState && record.trace ? selectArtifactOutcomeEvaluations(data.evolutionState,record.trace.id).flatMap(group=>[...(group.finalEvaluation ? [group.finalEvaluation]:[]),...group.dimensions]) : []
    const exact=outcomes.find(row=>row.evaluation.id===props.initialEvaluationId && row.evaluation.artifactId===props.initialArtifactId && row.evidence.some(item=>item.id===props.initialEvidenceId))
    const candidates=outcomes.filter(row=>row.evidence.some(item=>item.id===props.initialEvidenceId))
    const outcome=exact ?? (candidates.length===1 ? candidates[0] : undefined)
    if(outcome){
      const observationIds=[...new Set(outcome.evidence.flatMap(item=>item.observationId ? [item.observationId]:[]))]
      setEvidenceModule({id:outcome.evaluation.id,moduleLabel:`产物 · ${outcome.evaluation.dimension}`,traceId:record.trace?.id,score:outcome.automaticScore,scoreScale:'0-2',automaticStatus:outcome.automatic?.verdict==='NOT_APPLICABLE'?'N/A':outcome.automatic?.verdict ?? 'UNKNOWN',judgeReason:outcome.automatic?.reason,evalAgentVersion:outcome.evalAgentVersion,rubricVersion:outcome.evaluation.evalVersion,humanScore:outcome.humanScore,humanStatus:outcome.manual?.verdict,humanNote:outcome.manual?.reason,evidence:{rootEvidenceIds:outcome.evidence.map(item=>item.id),observationIds,logIds:record.logs.filter(item=>item.observationId && observationIds.includes(item.observationId)).map(item=>item.id),artifactIds:[outcome.evaluation.artifactId],rubricRule:outcome.rubricRule,completeness:outcome.evidence.length?'COMPLETE':'MISSING'}})
      return
    }
    const selected=record.moduleEvaluations?.find(item=>(item.evidence as {rootEvidenceIds?:string[]})?.rootEvidenceIds?.includes(props.initialEvidenceId!))
    setEvidenceModule(selected ?? {moduleLabel:'根证据',traceId:record.trace?.id,judgeReason:root?.content ?? '当前证据未绑定模块评分',evidence:{rootEvidenceIds:[props.initialEvidenceId],observationIds:root?.observationId ? [root.observationId]:[],logIds:record.logs.filter(item=>item.observationId===root?.observationId).map(item=>item.id),rubricRule:'对应 Rubric 条款待关联'}})
  },[props.initialEvidenceId,props.initialEvaluationId,props.initialArtifactId,record?.trace?.id])
  if(!record)return null
  const switchView=(value:string)=>{const view=normalizeCaseView(value);setTab(view);props.onViewChange?.(view)}
  const openReference=onNavigate ? (ref:{kind:CaseReference['kind'];id:string})=>onNavigate({...ref,label:ref.id}) : undefined
  const latest=record.governance ? selectLatestTraceState(record.governance) : {status:'UNKNOWN',label:'暂无流转记录',timeKnown:false}
  const moduleHistory=(data.moduleReviews ?? []).filter(review=>review.traceId===record.trace?.id && review.caseId===record.id && review.moduleScoreId===moduleHistoryId).sort((left,right)=>left.reviewedAt.localeCompare(right.reviewedAt) || left.id.localeCompare(right.id))
  const openObservation=(id?:string)=>{setNodeId(id);setNodeOpen(true);setAllNodes(false)}
  const selectTrace=(id:string)=>{setTraceId(id);setNodeId(undefined);setNodeOpen(false);setLog(undefined);setEvidenceModule(undefined);setModuleHistoryId(undefined);setTab('eval');onNavigate?.({kind:'trace',id,label:id,caseView:'eval'})}
  const openEvidence=(observation:Observation)=>{
    const score=record.moduleEvaluations?.find(item=>{const bundle=item.evidence as {observationIds?:string[];rootEvidenceIds?:string[]}|undefined;return bundle?.observationIds?.includes(observation.id)||bundle?.rootEvidenceIds?.some(id=>observation.evidenceIds.includes(id))})
    setEvidenceModule(score ?? {moduleLabel:observation.nodeType,traceId:record.trace?.id,judgeReason:observation.reason,evidence:{rootEvidenceIds:observation.evidenceIds,observationIds:[observation.id],logIds:record.logs.filter(item=>item.observationId===observation.id).map(item=>item.id),rubricRule:observation.rubricEvidence?.map(item=>item.requirement).join('\n') || '本节点未关联具体 Rubric 条款'}})
  }
  const moduleKey=(['Memory','Skill','Reason','Act','Context'].includes(module)?module:'Context') as EvolutionModule
  const saveCaseAction=async(kind:'confirmation'|'attribution')=>{
    if(saving)return;setSaveError('');setSaving(true)
    try{const common={caseId:record.id,by:'当前用户',createdAt:new Date().toISOString()};if(kind==='confirmation'){await props.onHumanConfirm?.({...common,status:confirmStatus,note:confirmNote.trim()||'Case 处理复核完成'});setConfirmOpen(false)}else{await props.onAttributionChange?.({...common,attributionId:attrId,module,dimension,routingTags:routing,note:attrNote.trim()||'人工调整归因'});setAttrOpen(false)}}catch(error){setSaveError(`保存失败：${error instanceof Error ? error.message:'请重试'}。已保留当前输入。`)}finally{setSaving(false)}
  }
  return <>
    <Drawer open width="max-w-5xl" onClose={onClose} closeLabel="关闭 Case 详情" title={<span className="inline-flex items-center gap-2"><span>Case 详情 ·</span><EntityId kind="case" id={record.id} onOpen={openReference}/></span>} description={<span className="flex flex-wrap gap-x-4 gap-y-2"><span>Session <EntityId kind="session" id={record.session.id} onOpen={openReference}/></span><span>Trace {record.trace ? <EntityId kind="trace" id={record.trace.id} onOpen={openReference}/>: '未记录'}</span></span>} footer={<div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted">Case 处理确认与评分复核分别记录</span><div className="flex gap-2"><Button icon={ClipboardCheck} onClick={()=>{setSaveError('');setConfirmOpen(true)}}>人工确认</Button><Button icon={Tags} onClick={()=>{setSaveError('');setAttrOpen(true)}}>调整归因</Button></div></div>}>
      <div className="space-y-4">
        <section aria-label="当前 Trace 概要" className="rounded-lg border border-line p-4"><p className="text-sm font-semibold leading-6">{record.task.query}</p><p className="mt-2 text-xs text-muted">{record.sourceLabel ?? 'mock集'} · Query 时间 {dateTime(record.task.timestamp)}（GMT+8）</p><div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2"><button type="button" className="rounded text-left hover:underline" onClick={()=>switchView('eval')}><StatusIndicator status={latest.status} label={`${latest.label} · ${statusIndicatorText(latest.status)}`} context="governance"/></button><span className="text-xs text-muted">Agent 执行耗时 {formatDuration(record.task.latency)}</span></div>{!latest.timeKnown && <p className="mt-2 text-[10px] text-muted">状态时间未记录</p>}</section>
        {(record.traces?.length ?? 0)>1 && <div className="flex flex-wrap gap-2 rounded-md border border-line bg-slate-50 p-3"><span className="text-xs font-semibold">切换 Trace</span>{record.traces?.map(trace=><IdLink key={trace.id} kind="trace" id={trace.id} label={`切换 Trace ${trace.id}`} onOpen={()=>selectTrace(trace.id)}/>)}</div>}
        <Tabs aria-label="Case detail views" activeId={tab} onChange={switchView} items={[...CASE_DETAIL_VIEWS]}/>
        <div role="tabpanel" id={`tabpanel-${tab}`} className="space-y-4">
          {tab==='session' && <section aria-label="完整 Session 对话"><p className="mb-3 text-xs text-muted">完整多轮对话 · 当前 Trace 对应轮次以边框标记</p><ol className="space-y-3">{record.session.turns.map(turn=><li key={turn.id} className={`rounded-lg border p-3 ${turn.traceId===record.trace?.id?'border-accent bg-accent/5':'border-line bg-slate-50'}`}><div className="flex flex-wrap justify-between gap-2 text-xs"><strong>{turn.role==='user'?'用户':'Agent'} · 第 {turn.sequence} 轮</strong><span className="text-muted">{dateTime(turn.createdAt)}</span></div><p className="my-3 whitespace-pre-wrap text-xs leading-6">{turn.content}</p>{turn.traceId && <IdLink kind="trace" id={turn.traceId} label={`打开 Trace ${turn.traceId}`} onOpen={()=>selectTrace(turn.traceId!)}/>}</li>)}</ol><div className="mt-4 rounded-lg border border-line p-3"><h3 className="text-xs font-semibold">用户反馈 · Case 共享</h3><p className="mt-2 whitespace-pre-wrap text-xs leading-6">{record.userFeedback}</p></div>{record.revisions.length>0 && <details className="rounded-lg border border-line p-4"><summary className="cursor-pointer text-sm font-semibold">Case 共享处理审计</summary><section aria-label="Case 共享处理审计" className="mt-3 space-y-2">{record.revisions.map(revision=><article key={revision.id} className="rounded border border-line p-3 text-xs"><p>{revision.by} · {dateTime(revision.at)}</p><p className="mt-2">{revision.note}</p></article>)}</section></details>}</section>}
          {tab==='eval' && <><Button onClick={()=>openObservation()}>查看执行节点</Button><CaseEvaluations key={record.trace?.id} view="process" initialEvaluationId={props.initialEvaluationId} record={record} data={data} initialModuleScoreId={props.initialModuleScoreId} initialScoreDimensionId={props.initialScoreDimensionId} initialEvolutionRecordId={props.initialEvolutionRecordId} initialEvolutionDirectionId={props.initialEvolutionDirectionId} onEvolutionDirectionChange={props.onEvolutionDirectionChange} sourceRoute={props.sourceRoute} onOpenEvolutionWorkbench={props.onOpenEvolutionWorkbench} onEvolutionDetailChange={props.onEvolutionDetailChange} onNavigate={onNavigate} onBackToTrace={openObservation} onModuleReview={props.onModuleReview} onReviewHistory={setModuleHistoryId}/></>}
          {tab==='outcome' && (data.evolutionState && record.trace ? <CaseOutcomeEvaluations key={record.trace.id} state={data.evolutionState} traceId={record.trace.id} initialArtifactId={props.initialArtifactId} initialEvaluationId={props.initialEvidenceId ? undefined : props.initialEvaluationId} onNavigateReference={openReference} onReview={props.onOutcomeReview} onOpenObservation={openObservation}/> : <section className="space-y-3">{record.artifacts.map(artifact=><article key={artifact.id} className="rounded-lg border border-line p-4"><h3 className="text-sm font-semibold">{artifact.name}</h3><p className="mt-2 text-xs text-muted">{artifact.type} · {artifact.version ?? '版本未记录'}</p><IdLink kind="artifact" id={artifact.id} onOpen={openReference}/><p className="mt-2 text-xs text-muted">细项评测记录未入库</p></article>)}{!record.artifacts.length && <EmptyState title="当前 Trace 无产物" description="尚无产物或产物记录未入库。"/>}</section>)}
        </div>
      </div>
    </Drawer>
    <Drawer open={Boolean(moduleHistoryId)} onClose={()=>setModuleHistoryId(undefined)} width="max-w-3xl" title="模块人工复核历史" closeLabel="关闭模块人工复核历史" description={`${record.moduleEvaluations?.find(score=>score.id===moduleHistoryId)?.moduleLabel ?? moduleHistoryId ?? ''} · 当前 Trace ${record.trace?.id ?? '未记录'}`}>
      <section aria-label="模块人工复核历史" className="space-y-3">{moduleHistory.map(review=><article key={review.id} data-review-id={review.id} className="rounded-md border border-line p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><strong>{record.moduleEvaluations?.find(score=>score.id===review.moduleScoreId)?.moduleLabel as string ?? review.moduleScoreId}</strong><StatusIndicator context="review" status="REVIEWED"/></div><p className="mt-2">{review.reviewer} · {dateTime(review.reviewedAt)}（GMT+8）</p><p className="mt-2">自动 {review.automaticSnapshot.score===undefined?'未评分':`${(review.automaticSnapshot.score*(review.automaticSnapshot.scoreScale==='0-1'?2:1)).toFixed(2)} / 2`} · 人工 {review.humanScore===undefined?'未评分':`${review.humanScore.toFixed(2)} / 2`} · {review.auxiliaryVerdict}</p><p className="mt-2 whitespace-pre-wrap">人工说明：{review.reason}</p><p className="mt-2 whitespace-pre-wrap text-muted">自动 Judge Reason：{review.automaticSnapshot.judgeReason}</p><p className="mt-2 break-words text-muted">Rubric {review.rubricVersion} · {review.rubricRule} · Eval Agent {review.evalAgentVersion}</p><p className="mt-2 break-all font-mono text-[10px] text-muted">评测包 {review.packageId} · 自动版本 {review.automaticRevisionId}</p><div className="mt-2 flex flex-wrap gap-3">{review.evidenceIds.map(id=><IdLink key={id} kind="evidence" id={id} onOpen={openReference}/>)}</div><details className="mt-3 rounded border border-line p-3"><summary className="cursor-pointer font-semibold">完整自动评测快照 / Evidence</summary><pre className="mt-3 whitespace-pre-wrap break-words text-[11px] leading-5 text-muted">{JSON.stringify(review.automaticSnapshot,null,2)}</pre></details></article>)}{!moduleHistory.length && <EmptyState title="当前模块尚无人工复核记录" description="只展示当前 Trace 和模块的历史，不借用其他模块或 Trace 的记录。"/>}</section>
    </Drawer>
    <Drawer open={nodeOpen} onClose={()=>setNodeOpen(false)} width="max-w-3xl" title="执行节点详情"><div className="mb-3 flex flex-wrap gap-2"><Button onClick={()=>setAllNodes(value=>!value)}>{allNodes?'收起执行节点':'查看该 Trace 全部节点'}</Button><Button disabled={!node} onClick={()=>node && openEvidence(node)}>查看根证据 + Rubric</Button><Button icon={Braces} disabled={!record.logs.some(item=>item.observationId===node?.id)} onClick={()=>setLog(record.logs.find(item=>item.observationId===node?.id))}>查看节点 Log</Button></div>{allNodes && <TraceTimeline trace={record.trace} evidence={data.evidence} compact selectedObservationId={node?.id} onObservationClick={item=>setNodeId(item.id)} onEvidenceClick={(_,source)=>source && openEvidence(source)}/>}<ObservationDetails observation={node} evidence={data.evidence} embedded onNavigateReference={openReference}/></Drawer>
    <EvidenceBundleDrawer open={Boolean(evidenceModule)} module={evidenceModule} onClose={()=>setEvidenceModule(undefined)} evidence={(data.rootEvidence ?? data.evidence.map(item=>({...item,content:item.summary}))) as unknown as Record<string,unknown>[]} onNavigateReference={openReference}/>
    <Drawer open={Boolean(log)} onClose={()=>setLog(undefined)} title="Log 详情" description={log?.id}>{log && <><EntityId id={log.traceId} kind="trace" onOpen={openReference}/><p className="mt-2 text-xs text-muted">{log.level} · {dateTime(log.timestamp)}</p><pre className="mt-4 whitespace-pre-wrap break-words rounded bg-slate-950 p-4 text-xs text-white">{log.message}</pre></>}</Drawer>
    <Modal open={confirmOpen} onClose={()=>setConfirmOpen(false)} title="人工确认" description="Case 级处理确认，不代替模块或产物评分复核。"><Field label="人工结论"><SelectInput aria-label="人工结论" value={confirmStatus} onChange={event=>setConfirmStatus(event.target.value as JudgeStatus)}>{['PASS','FAIL','UNKNOWN'].map(value=><option key={value}>{value}</option>)}</SelectInput></Field><Field label="确认说明" className="mt-3"><TextArea aria-label="确认说明" value={confirmNote} onChange={event=>setConfirmNote(event.target.value)}/></Field>{saveError && <p role="alert" className="mt-2 text-xs text-fail">{saveError}</p>}<Button className="mt-3" disabled={saving || !props.onHumanConfirm} onClick={()=>void saveCaseAction('confirmation')}>保存人工结论</Button></Modal>
    <Modal open={attrOpen} onClose={()=>setAttrOpen(false)} title="调整归因"><div className="space-y-3"><Field label="目标归因"><SelectInput aria-label="目标归因" value={attrId} onChange={event=>{const selected=record.attributions?.find(item=>item.id===event.target.value);setAttrId(event.target.value);if(selected){setModule(selected.module??'Skill');setDimension(selected.dimension??'');setRouting(selected.routingTags??[])}}}>{record.attributions?.map(item=><option key={item.id} value={item.id}>{item.id} · {item.module} · {item.dimension}</option>)}</SelectInput></Field><Field label="归因模块"><SelectInput aria-label="归因模块" value={module} onChange={event=>{setModule(event.target.value);setDimension(ATTRIBUTION_DIMENSIONS[event.target.value as EvolutionModule][0])}}>{['Memory','Skill','Reason','Act','Context'].map(value=><option key={value}>{value}</option>)}</SelectInput></Field><Field label="归因维度"><SelectInput aria-label="归因维度" value={dimension} onChange={event=>setDimension(event.target.value)}>{ATTRIBUTION_DIMENSIONS[moduleKey].map(value=><option key={value}>{value}</option>)}</SelectInput></Field><fieldset><legend className="text-xs">分流标签（可多选）</legend>{['策略迭代','Agent 迭代'].map(tag=><label key={tag} className="mr-3 text-xs"><input aria-label={tag} type="checkbox" checked={routing.includes(tag)} onChange={()=>setRouting(current=>current.includes(tag)?current.filter(item=>item!==tag):[...current,tag])}/> {tag}</label>)}</fieldset><Field label="调整说明"><TextArea aria-label="调整说明" value={attrNote} onChange={event=>setAttrNote(event.target.value)}/></Field>{saveError && <p role="alert" className="text-xs text-fail">{saveError}</p>}<Button disabled={!attrId || saving || !props.onAttributionChange} onClick={()=>void saveCaseAction('attribution')}>保存归因调整</Button></div></Modal>
  </>
}
