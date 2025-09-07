import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReportButtonsForBooth, submitReport, validateCheckin, getButtonConfigs, submitSalesCheckin, getDepartmentsByEvent, getStaffByEvent } from '../services/api';
import { ReportButtonConfig, ReportType, Department, Staff } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';

const InformesPage: React.FC = () => {
  const { boothCode } = useParams<{ boothCode: string }>();
  const navigate = useNavigate();
  
  const [checkinInfo, setCheckinInfo] = useState<{staffName: string, eventId: string, personalCode: string, departmentId?: string, companyName: string, staffId: string} | null>(null);
  const [allButtons, setAllButtons] = useState<ReportButtonConfig[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for report submission modal
  const [selectedButton, setSelectedButton] = useState<ReportButtonConfig | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [primaryResponse, setPrimaryResponse] = useState('');
  const [checklistSelection, setChecklistSelection] = useState<string[]>([]);
  const [followUpResponse, setFollowUpResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean | null>(null);
  const [respondedButtonIds, setRespondedButtonIds] = useState<string[]>([]);

  // State for booth switching modal
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [newBoothCode, setNewBoothCode] = useState('');
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');

  // State for Sales Check-in
  const [salesCheckinStaffIds, setSalesCheckinStaffIds] = useState<string[]>([]);
  const [notifyCallStaffIds, setNotifyCallStaffIds] = useState<string[]>([]);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [hadSales, setHadSales] = useState<'Sim' | 'Não' | null>(null);
  const [salesPeriod, setSalesPeriod] = useState<'Manhã' | 'Tarde' | 'Noite' | ''>('');
  const [salesCount, setSalesCount] = useState<number>(0);
  const [soldModels, setSoldModels] = useState<string[]>([]);
  const [salesSubmitting, setSalesSubmitting] = useState(false);
  const [salesSubmitStatus, setSalesSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // State for Notification Call
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notificationStep, setNotificationStep] = useState<'department' | 'staff' | 'reason'>('department');
  const [selectedNotificationDeptId, setSelectedNotificationDeptId] = useState<string | null>(null);
  const [selectedNotificationStaff, setSelectedNotificationStaff] = useState<Staff | null>(null);
  const [notificationReason, setNotificationReason] = useState('');


  useEffect(() => {
    let eventIdForFetch: string | null = null;
    const checkinInfoRaw = sessionStorage.getItem('checkinInfo');
    if (checkinInfoRaw) {
      try {
        const info = JSON.parse(checkinInfoRaw);
        eventIdForFetch = info.eventId || null;
        setCheckinInfo({
            staffName: info.staffName || '',
            eventId: info.eventId || '',
            personalCode: info.personalCode || '',
            departmentId: info.departmentId,
            companyName: info.companyName || '',
            staffId: info.staffId || ''
        });
      } catch (e) {
        console.error("Failed to parse checkinInfo from sessionStorage", e);
        navigate('/');
      }
    } else {
        navigate('/');
    }
    
    setRespondedButtonIds([]);

    const fetchButtonsAndEventData = async () => {
      if (!boothCode || !eventIdForFetch) return;
      try {
        setLoading(true);
        const [companyButtons, allSystemButtons, depts, staff] = await Promise.all([
            getReportButtonsForBooth(boothCode),
            getButtonConfigs(),
            getDepartmentsByEvent(eventIdForFetch),
            getStaffByEvent(eventIdForFetch)
        ]);
        setDepartments(depts);
        setAllStaff(staff);

        const buttonsMap = new Map<string, ReportButtonConfig>();
        companyButtons.forEach(btn => buttonsMap.set(btn.id, btn));
        allSystemButtons.forEach(btn => {
            if (!buttonsMap.has(btn.id)) {
                buttonsMap.set(btn.id, btn);
            }
        });

        const salesConfigs = allSystemButtons.filter(b => b.label === '__SALES_CHECKIN_CONFIG__');
        setSalesCheckinStaffIds(salesConfigs.map(c => c.staffId).filter((id): id is string => !!id));

        const notifyCallConfigs = allSystemButtons.filter(b => b.label === '__NOTIFY_CALL_CONFIG__' && b.type === ReportType.NOTIFY_CALL);
        setNotifyCallStaffIds(notifyCallConfigs.map(c => c.staffId).filter((id): id is string => !!id));
        
        setAllButtons(Array.from(buttonsMap.values()));
      } catch (err) {
        setError('Falha ao carregar as ações.');
      } finally {
        setLoading(false);
      }
    };
    fetchButtonsAndEventData();
  }, [boothCode, navigate]);

  const visibleButtons = useMemo(() => {
    if (!checkinInfo || !checkinInfo.staffId) return [];
    
    return allButtons.filter(button => 
        button.label !== '__SALES_CHECKIN_CONFIG__' &&
        button.label !== '__NOTIFY_CALL_CONFIG__' &&
        !respondedButtonIds.includes(button.id) &&
        (button.staffId === checkinInfo.staffId || (!button.staffId && (!button.departmentId || button.departmentId === checkinInfo.departmentId)))
    );
  }, [allButtons, checkinInfo, respondedButtonIds]);

  // Effect to trigger webhook when all buttons are completed
  useEffect(() => {
    const sendCompletionWebhook = async () => {
        if (checkinInfo && boothCode) {
            try {
                const payload = {
                    staffName: checkinInfo.staffName,
                    boothCode: boothCode,
                    companyName: checkinInfo.companyName,
                };
                await fetch('https://webhook.triad3.io/webhook/notificar-empesa-cie', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (error) {
                console.error("Failed to send completion webhook:", error);
            }
        }
    };

    if (!loading && allButtons.length > 0 && respondedButtonIds.length > 0 && visibleButtons.length === 0) {
        sendCompletionWebhook();
    }
  }, [visibleButtons, allButtons, respondedButtonIds, checkinInfo, boothCode, loading]);


  const handleButtonClick = (button: ReportButtonConfig) => {
    setSelectedButton(button);
    setSubmissionSuccess(null);
    setPrimaryResponse('');
    setFollowUpResponse('');
    setChecklistSelection([]);
    setIsReportModalOpen(true);
  };

  const openNotifyCallModal = () => {
    const notifyButtonConfig: ReportButtonConfig = {
        id: '__NOTIFY_CALL_CONFIG__',
        label: 'Abrir Chamado',
        question: '',
        type: ReportType.NOTIFY_CALL,
    };
    setSelectedButton(notifyButtonConfig);
    setSubmissionSuccess(null);
    setNotificationStep('department');
    setSelectedNotificationDeptId(null);
    setSelectedNotificationStaff(null);
    setNotificationReason('');
    setIsNotificationModalOpen(true);
  };

  const handleModalClose = useCallback(() => {
    setIsReportModalOpen(false);
    setIsNotificationModalOpen(false);
    setSelectedButton(null);
  }, []);
  
  const handleExit = () => {
    sessionStorage.removeItem('checkinInfo');
    navigate('/');
  }
  
  const handleChecklistChange = (value: string) => {
    setChecklistSelection(prev =>
        prev.includes(value)
            ? prev.filter(item => item !== value)
            : [...prev, value]
    );
  };


  const handleSwitchBooth = async () => {
    if (!newBoothCode || !checkinInfo?.personalCode) {
        setSwitchError('Por favor, insira o código do estande.');
        return;
    }
    setSwitching(true);
    setSwitchError('');
    try {
        const { staff, event, company } = await validateCheckin(newBoothCode, checkinInfo.personalCode);
        sessionStorage.setItem('checkinInfo', JSON.stringify({
            boothCode: newBoothCode.toUpperCase(),
            companyName: company.name,
            personalCode: checkinInfo.personalCode,
            staffName: staff.name,
            eventId: event.id,
            departmentId: staff.departmentId,
            staffId: staff.id,
        }));
        setIsSwitchModalOpen(false);
        setNewBoothCode('');
        navigate(`/informes/${newBoothCode.toUpperCase()}`);
    } catch (err) {
        setSwitchError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
    } finally {
        setSwitching(false);
    }
  };

  const openSalesCheckinModal = () => {
    setHadSales(null);
    setSalesPeriod('');
    setSalesCount(0);
    setSoldModels([]);
    setSalesSubmitStatus('idle');
    setIsSalesModalOpen(true);
  };

  const handleSalesCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value, 10) || 0;
    const positiveCount = Math.max(0, count);
    setSalesCount(positiveCount);
    setSoldModels(currentModels => {
        const newModels = [...currentModels];
        newModels.length = positiveCount;
        return newModels.fill('', currentModels.length);
    });
  };

  const handleSoldModelChange = (index: number, value: string) => {
    setSoldModels(currentModels => {
        const newModels = [...currentModels];
        newModels[index] = value;
        return newModels;
    });
  };

  const handleSubmitSalesCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkinInfo || !boothCode) return;

    setSalesSubmitting(true);
    setSalesSubmitStatus('idle');

    const payload = {
        boothCode: boothCode,
        companyName: checkinInfo.companyName,
        staffName: checkinInfo.staffName,
        houveVendas: hadSales,
        periodoVendas: hadSales === 'Sim' ? salesPeriod : null,
        quantidadeVendas: hadSales === 'Sim' ? salesCount : 0,
        modelosVendidos: hadSales === 'Sim' ? soldModels.filter(m => m && m.trim() !== '') : [],
        timestamp: new Date().toISOString(),
    };

    try {
      await submitSalesCheckin(payload, checkinInfo.staffId);
      setSalesSubmitStatus('success');
      setTimeout(() => setIsSalesModalOpen(false), 2000);
    } catch (error) {
      console.error(error);
      setSalesSubmitStatus('error');
    } finally {
      setSalesSubmitting(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedButton || !boothCode || !checkinInfo) return;
    
    setSubmitting(true);
    setSubmissionSuccess(null);

    let finalResponse = primaryResponse;

    if (selectedButton.type === ReportType.CHECKLIST) {
        finalResponse = checklistSelection.length > 0 ? checklistSelection.join(', ') : 'Nenhum item selecionado.';
    } else if (
      selectedButton.type === ReportType.YES_NO && 
      selectedButton.followUp &&
      primaryResponse === selectedButton.followUp.triggerValue &&
      followUpResponse
    ) {
      finalResponse = `${primaryResponse} - ${selectedButton.followUp.question}: ${followUpResponse}`;
    }

    try {
      await submitReport({
        eventId: checkinInfo.eventId,
        boothCode,
        staffName: checkinInfo.staffName,
        reportLabel: selectedButton.label,
        response: finalResponse,
      });
      setSubmissionSuccess(true);
      setRespondedButtonIds(prev => [...prev, selectedButton.id]);
      setTimeout(() => {
        handleModalClose();
      }, 1500);
    } catch (err) {
      setSubmissionSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitNotificationCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedButton || !boothCode || !checkinInfo || !selectedNotificationStaff) return;

    setSubmitting(true);
    setSubmissionSuccess(null);

    try {
        const webhookPayload = {
            staffName: checkinInfo.staffName,
            companyName: checkinInfo.companyName,
            targetStaffPhone: selectedNotificationStaff.phone,
            targetStaffName: selectedNotificationStaff.name,
            reason: notificationReason,
        };
        const webhookResponse = await fetch('https://webhook.triad3.io/webhook/notificar-chamado-cie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
        });
        if (!webhookResponse.ok) {
            const errorText = await webhookResponse.text();
            throw new Error(`Falha ao enviar notificação: ${errorText}`);
        }

        const reportResponse = `Chamado aberto para ${selectedNotificationStaff.name} (Depto: ${departments.find(d => d.id === selectedNotificationStaff.departmentId)?.name || 'N/A'}). Motivo: "${notificationReason}"`;
        await submitReport({
            eventId: checkinInfo.eventId,
            boothCode,
            staffName: checkinInfo.staffName,
            reportLabel: selectedButton.label,
            response: reportResponse,
        });

        setSubmissionSuccess(true);
        if (selectedButton.id !== '__NOTIFY_CALL_CONFIG__') {
          setRespondedButtonIds(prev => [...prev, selectedButton.id]);
        }
        setTimeout(() => {
            handleModalClose();
        }, 1500);

    } catch (err) {
        setSubmissionSuccess(false);
        console.error(err);
    } finally {
        setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-red-500 text-center">{error}</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 p-4 bg-card rounded-lg shadow">
          <div>
            <h2 className="text-2xl font-bold text-center sm:text-left">
              Estande: <span className="text-primary">{checkinInfo?.companyName || boothCode}</span>
            </h2>
            <p className="text-sm text-text-secondary text-center sm:text-left">Código: {boothCode}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsSwitchModalOpen(true)}>
                Trocar Estande
            </Button>
            <Button variant="danger" onClick={handleExit}>Sair</Button>
          </div>
      </div>

      {checkinInfo && checkinInfo.staffId && (salesCheckinStaffIds.includes(checkinInfo.staffId) || notifyCallStaffIds.includes(checkinInfo.staffId)) && (
        <div className="my-8 p-4 bg-card rounded-lg shadow-lg">
            <h3 className="text-xl mb-4 text-center">Ações Especiais</h3>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              {salesCheckinStaffIds.includes(checkinInfo.staffId) && (
                <Button onClick={openSalesCheckinModal} className="w-full sm:w-auto">
                    Check-in de Vendas
                </Button>
              )}
              {notifyCallStaffIds.includes(checkinInfo.staffId) && (
                <Button onClick={openNotifyCallModal} className="w-full sm:w-auto">
                    Abrir Chamado
                </Button>
              )}
            </div>
        </div>
      )}

      <div className="border-t border-border pt-8 mt-8">
        <h3 className="text-xl mb-4 text-center">Ações Gerais Disponíveis</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {visibleButtons.map((button) => (
            <button key={button.id} onClick={() => handleButtonClick(button)} className="p-6 bg-card rounded-lg shadow-lg text-center transition-transform transform hover:-translate-y-1 hover:shadow-xl">
                <span className="text-xl font-semibold">{button.label}</span>
            </button>
            ))}
            {visibleButtons.length === 0 && (
                <p className="col-span-full text-center text-text-secondary">Todas as ações para esta visita foram concluídas.</p>
            )}
        </div>
      </div>

      {/* Report Submission Modal */}
      {selectedButton && (
        <Modal isOpen={isReportModalOpen} onClose={handleModalClose} title={selectedButton.label}>
          {submissionSuccess === true ? (
             <div className="text-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-4 text-lg font-semibold">Informe enviado com sucesso!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitReport}>
              <p className="mb-4 text-lg">{selectedButton.question}</p>
              
              {selectedButton.type === ReportType.OPEN_TEXT && (
                <textarea
                  value={primaryResponse}
                  onChange={(e) => setPrimaryResponse(e.target.value)}
                  className="w-full p-2 border border-border rounded-md bg-background"
                  rows={4}
                  required
                />
              )}

              {selectedButton.type === ReportType.MULTIPLE_CHOICE && selectedButton.options && (
                <div className="space-y-2">
                  {selectedButton.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-border cursor-pointer">
                      <input
                        type="radio"
                        name="report-option"
                        value={option.label}
                        checked={primaryResponse === option.label}
                        onChange={(e) => setPrimaryResponse(e.target.value)}
                        required
                        className="form-radio text-primary focus:ring-primary"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {selectedButton.type === ReportType.CHECKLIST && selectedButton.options && (
                <div className="space-y-2">
                  {selectedButton.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-border cursor-pointer">
                      <input
                        type="checkbox"
                        name="report-option-checklist"
                        value={option.label}
                        checked={checklistSelection.includes(option.label)}
                        onChange={() => handleChecklistChange(option.label)}
                        className="form-checkbox h-5 w-5 rounded text-primary focus:ring-primary bg-background border-border"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {selectedButton.type === ReportType.YES_NO && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    {['Sim', 'Não'].map(option => (
                        <label key={option} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-md border-2 border-border hover:bg-border cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-black has-[:checked]:border-primary">
                          <input
                            type="radio"
                            name="yes-no-option"
                            value={option}
                            checked={primaryResponse === option}
                            onChange={(e) => setPrimaryResponse(e.target.value)}
                            required
                            className="sr-only"
                          />
                          <span className="font-semibold">{option}</span>
                        </label>
                    ))}
                  </div>

                  {selectedButton.followUp && primaryResponse === selectedButton.followUp.triggerValue && (
                    <div className="border-t border-border pt-4 animate-fade-in">
                        <label className="block text-sm font-medium mb-2" htmlFor="followUpInput">
                            {selectedButton.followUp.question}
                        </label>
                        {selectedButton.followUp.type === ReportType.MULTIPLE_CHOICE && selectedButton.followUp.options ? (
                           <div className="space-y-2">
                            {selectedButton.followUp.options.map((option) => (
                              <label key={option.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-border cursor-pointer">
                                <input
                                  type="radio"
                                  name="follow-up-option"
                                  value={option.label}
                                  checked={followUpResponse === option.label}
                                  onChange={(e) => setFollowUpResponse(e.target.value)}
                                  required
                                  className="form-radio text-primary focus:ring-primary"
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <textarea
                              id="followUpInput"
                              value={followUpResponse}
                              onChange={(e) => setFollowUpResponse(e.target.value)}
                              className="w-full p-2 border border-border rounded-md bg-background"
                              rows={2}
                              required
                          />
                        )}
                    </div>
                  )}
                </div>
              )}

              {submissionSuccess === false && <p className="text-red-500 mt-2 text-center">Falha ao enviar o informe.</p>}
              <div className="mt-6 flex justify-end gap-4">
                <Button type="button" variant="secondary" onClick={handleModalClose}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <LoadingSpinner /> : 'Enviar'}
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
      
      {/* Notification Call Modal */}
      <Modal isOpen={isNotificationModalOpen} onClose={handleModalClose} title={selectedButton?.label || 'Notificar Chamado'}>
          {submissionSuccess === true ? (
             <div className="text-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-4 text-lg font-semibold">Chamado enviado com sucesso!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitNotificationCall}>
                {notificationStep === 'department' && (
                    <div>
                        <h3 className="text-lg font-semibold mb-3">Para qual departamento é o chamado?</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {departments.map(dept => (
                                <button type="button" key={dept.id} onClick={() => { setSelectedNotificationDeptId(dept.id); setNotificationStep('staff'); }} className="w-full text-left p-3 rounded-md bg-secondary hover:bg-secondary-hover transition-colors">
                                    {dept.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {notificationStep === 'staff' && (
                    <div>
                        <div className="flex items-center mb-3">
                            <Button type="button" variant="secondary" onClick={() => setNotificationStep('department')} className="mr-4 text-sm px-2 py-1">Voltar</Button>
                            <h3 className="text-lg font-semibold">Para qual membro da equipe?</h3>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {allStaff.filter(s => s.departmentId === selectedNotificationDeptId).map(staff => (
                                <button type="button" key={staff.id} onClick={() => { setSelectedNotificationStaff(staff); setNotificationStep('reason'); }} className="w-full text-left p-3 rounded-md bg-secondary hover:bg-secondary-hover transition-colors flex items-center gap-3">
                                    <img src={staff.photoUrl} alt={staff.name} className="w-10 h-10 rounded-full object-cover"/>
                                    <span>{staff.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {notificationStep === 'reason' && (
                    <div>
                         <div className="flex items-center mb-3">
                            <Button type="button" variant="secondary" onClick={() => setNotificationStep('staff')} className="mr-4 text-sm px-2 py-1">Voltar</Button>
                            <h3 className="text-lg font-semibold">Qual o motivo do chamado?</h3>
                        </div>
                        <p className="mb-2 text-text-secondary">Para: <span className="font-bold text-text">{selectedNotificationStaff?.name}</span></p>
                        <textarea
                            value={notificationReason}
                            onChange={(e) => setNotificationReason(e.target.value)}
                            className="w-full p-2 border border-border rounded-md bg-background"
                            rows={4}
                            placeholder="Digite o motivo aqui..."
                            required
                        />
                         {submissionSuccess === false && <p className="text-red-500 mt-2 text-center">Falha ao enviar o chamado.</p>}
                        <div className="mt-6 flex justify-end gap-4">
                            <Button type="button" variant="secondary" onClick={handleModalClose}>Cancelar</Button>
                            <Button type="submit" disabled={submitting}>
                            {submitting ? <LoadingSpinner /> : 'Enviar Chamado'}
                            </Button>
                        </div>
                    </div>
                )}
            </form>
          )}
      </Modal>

      {/* Switch Booth Modal */}
      <Modal isOpen={isSwitchModalOpen} onClose={() => setIsSwitchModalOpen(false)} title="Trocar de Estande">
        <div className="space-y-4">
          <p>Você está logado como <span className="font-bold">{checkinInfo?.staffName}</span> (Cód: {checkinInfo?.personalCode}).</p>
          <Input 
            id="new-booth-code"
            label="Código do Novo Estande"
            value={newBoothCode}
            onChange={e => setNewBoothCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="Digite o código do estande"
            autoFocus
          />
          {switchError && <p className="text-red-500 text-sm">{switchError}</p>}
          <div className="flex justify-end gap-4 pt-2">
            <Button variant="secondary" onClick={() => setIsSwitchModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSwitchBooth} disabled={switching}>
                {switching ? <LoadingSpinner /> : 'Validar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sales Check-in Modal */}
      <Modal isOpen={isSalesModalOpen} onClose={() => setIsSalesModalOpen(false)} title="Check-in de Vendas">
        {salesSubmitStatus === 'success' ? (
            <div className="text-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-4 text-lg font-semibold">Check-in de vendas enviado com sucesso!</p>
            </div>
        ) : (
            <form onSubmit={handleSubmitSalesCheckin} className="space-y-6">
                <div>
                    <p className="font-medium mb-2">Houve vendas?</p>
                    <div className="flex gap-4">
                        {['Sim', 'Não'].map(option => (
                            <label key={option} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-md border-2 border-border hover:bg-border cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-black has-[:checked]:border-primary">
                                <input type="radio" name="had-sales" value={option} checked={hadSales === option} onChange={(e) => setHadSales(e.target.value as 'Sim' | 'Não')} required className="sr-only" />
                                <span className="font-semibold">{option}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {hadSales === 'Sim' && (
                    <div className="space-y-6 border-t border-border pt-6 animate-fade-in">
                        <div>
                            <p className="font-medium mb-2">Em qual período foram feitas essas vendas?</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                {['Manhã', 'Tarde', 'Noite'].map(option => (
                                    <label key={option} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-md border-2 border-border hover:bg-border cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-black has-[:checked]:border-primary">
                                        <input type="radio" name="sales-period" value={option} checked={salesPeriod === option} onChange={(e) => setSalesPeriod(e.target.value as 'Manhã'|'Tarde'|'Noite')} required className="sr-only" />
                                        <span className="font-semibold">{option}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <Input
                            id="sales-count"
                            label="Quantas vendas?"
                            type="number"
                            value={salesCount}
                            onChange={handleSalesCountChange}
                            min="0"
                            required
                        />

                        {salesCount > 0 && (
                            <div>
                                <p className="font-medium mb-2">Por favor, digite aqui os modelos vendidos 👇👇</p>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {Array.from({ length: salesCount }).map((_, index) => (
                                        <Input
                                            key={index}
                                            id={`model-${index}`}
                                            label={`Venda ${index + 1}`}
                                            type="text"
                                            value={soldModels[index] || ''}
                                            onChange={(e) => handleSoldModelChange(index, e.target.value)}
                                            placeholder="Modelo do produto"
                                            className="mb-0"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {salesSubmitStatus === 'error' && (
                  <p className="text-red-500 text-sm text-center">Ocorreu um erro ao enviar. Por favor, tente novamente.</p>
                )}

                <div className="flex justify-end gap-4 pt-4">
                    <Button type="button" variant="secondary" onClick={() => setIsSalesModalOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={salesSubmitting}>
                        {salesSubmitting ? <LoadingSpinner /> : 'Salvar'}
                    </Button>
                </div>
            </form>
        )}
      </Modal>

      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default InformesPage;