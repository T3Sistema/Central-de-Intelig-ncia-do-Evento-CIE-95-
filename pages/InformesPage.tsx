import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReportButtonsForBooth, submitReport, validateCheckin, getButtonConfigs } from '../services/api';
import { ReportButtonConfig, ReportType } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';

const InformesPage: React.FC = () => {
  const { boothCode } = useParams<{ boothCode: string }>();
  const navigate = useNavigate();
  
  const [checkinInfo, setCheckinInfo] = useState<{staffName: string, eventId: string, personalCode: string, departmentId?: string, companyName: string, staffId: string} | null>(null);
  const [allButtons, setAllButtons] = useState<ReportButtonConfig[]>([]);
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
  const [salesCheckinStaffId, setSalesCheckinStaffId] = useState<string | null>(null);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [hadSales, setHadSales] = useState<'Sim' | 'Não' | null>(null);
  const [salesPeriod, setSalesPeriod] = useState<'Manhã' | 'Tarde' | 'Noite' | ''>('');
  const [salesCount, setSalesCount] = useState<number>(0);
  const [soldModels, setSoldModels] = useState<string[]>([]);
  const [salesSubmitting, setSalesSubmitting] = useState(false);
  const [salesSubmitStatus, setSalesSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');


  useEffect(() => {
    const checkinInfoRaw = sessionStorage.getItem('checkinInfo');
    if (checkinInfoRaw) {
      try {
        const info = JSON.parse(checkinInfoRaw);
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

    const fetchButtons = async () => {
      if (!boothCode) return;
      try {
        setLoading(true);
        // Fetch buttons specifically assigned to the company AND all other buttons in the system.
        // This ensures staff-specific buttons are always available to be filtered.
        const [companyButtons, allSystemButtons] = await Promise.all([
            getReportButtonsForBooth(boothCode),
            getButtonConfigs()
        ]);

        // Merge the two lists, removing duplicates.
        const buttonsMap = new Map<string, ReportButtonConfig>();
        companyButtons.forEach(btn => buttonsMap.set(btn.id, btn));
        allSystemButtons.forEach(btn => {
            if (!buttonsMap.has(btn.id)) {
                buttonsMap.set(btn.id, btn);
            }
        });

        const salesConfig = allSystemButtons.find(b => b.label === '__SALES_CHECKIN_CONFIG__');
        if (salesConfig) setSalesCheckinStaffId(salesConfig.staffId || null);
        
        setAllButtons(Array.from(buttonsMap.values()));
      } catch (err) {
        setError('Falha ao carregar as ações.');
      } finally {
        setLoading(false);
      }
    };
    fetchButtons();
  }, [boothCode, navigate]);

  const visibleButtons = useMemo(() => {
    if (!checkinInfo || !checkinInfo.staffId) return [];
    
    // A button is visible if:
    // 1. It has NOT been responded to in this session.
    // 2. It is assigned directly to the logged-in staff member.
    // 3. OR, if not assigned to a specific staff member, it follows the department/general logic:
    //    a. It is visible if it has no department (general for all).
    //    b. OR it is visible if its department matches the staff's department.
    return allButtons.filter(button => 
        button.label !== '__SALES_CHECKIN_CONFIG__' &&
        !respondedButtonIds.includes(button.id) &&
        (button.staffId === checkinInfo.staffId || 
        (!button.staffId && (!button.departmentId || button.departmentId === checkinInfo.departmentId)))
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

    // This condition ensures the webhook fires only once when all visible buttons are cleared.
    // It checks if loading is done, there were buttons to begin with, at least one has been responded to, and now none are left.
    if (!loading && allButtons.length > 0 && respondedButtonIds.length > 0 && visibleButtons.length === 0) {
        sendCompletionWebhook();
    }
  }, [visibleButtons, allButtons, respondedButtonIds, checkinInfo, boothCode, loading]);


  const handleButtonClick = (button: ReportButtonConfig) => {
    setSelectedButton(button);
    setPrimaryResponse('');
    setFollowUpResponse('');
    setChecklistSelection([]);
    setSubmissionSuccess(null);
    setIsReportModalOpen(true);
  };

  const handleModalClose = useCallback(() => {
    setIsReportModalOpen(false);
    setSelectedButton(null);
// FIX: Add missing dependencies to useCallback
  }, [setIsReportModalOpen, setSelectedButton]);
  
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
      const response = await fetch('https://webhook.triad3.io/webhook/chek-in-vendas-cie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Falha no envio do webhook.');
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

      {checkinInfo && salesCheckinStaffId === checkinInfo.staffId && (
        <div className="my-8 p-4 bg-card rounded-lg shadow-lg text-center">
            <h3 className="text-xl mb-4 text-center">Check-in Especial</h3>
            <Button onClick={openSalesCheckinModal} className="w-full sm:w-auto">
                Check-in de Vendas
            </Button>
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
