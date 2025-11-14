import React, { useState, useCallback, DragEvent, useRef } from 'react';
import { generateImages, refineImage } from './services/geminiService';
import { Loader } from './components/Loader';
import { UploadIcon, RetryIcon, StartOverIcon, DownloadIcon, WarningIcon, EditIcon, BackIcon, VariationIcon } from './components/Icons';

type AppState = 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'EDITING' | 'ERROR';
export type GenerationMode = 'ECOMMERCE' | 'SOCIAL';

export default function App() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [generatedImageUrls, setGeneratedImageUrls] = useState<string[]>([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('ECOMMERCE');
  const [editPrompt, setEditPrompt] = useState('');
  const [processingMessage, setProcessingMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInitialGeneration = useCallback(async (file: File) => {
    setAppState('PROCESSING');
    setProcessingMessage(generationMode === 'ECOMMERCE' ? 'Recriando com perfeição...' : 'Criando suas fotos ambiente...');
    setError(null);
    setGeneratedImageUrls([]);
    setSelectedImageUrl(null);

    try {
      const resultDataUrls = await generateImages(file, generationMode);
      setGeneratedImageUrls(resultDataUrls);
      setAppState('SUCCESS');
    } catch (err) {
      console.error(err);
      setError('A IA não conseguiu processar a imagem. Por favor, tente novamente ou use uma foto diferente.');
      setAppState('ERROR');
    }
  }, [generationMode]);

  const handleRefinement = useCallback(async (prompt: string) => {
    if (!selectedImageUrl) return;

    setAppState('PROCESSING');
    setProcessingMessage('Refinando sua imagem...');
    setError(null);
    
    try {
      const resultDataUrls = await refineImage(selectedImageUrl, prompt);
      setGeneratedImageUrls(resultDataUrls);
      setSelectedImageUrl(null);
      setEditPrompt('');
      setAppState('SUCCESS');
    } catch (err) {
      console.error(err);
      setError('A IA não conseguiu refinar a imagem. Por favor, tente novamente.');
      setAppState('ERROR'); // Or back to EDITING?
    }
  }, [selectedImageUrl]);


  const handleStartOver = () => {
    generatedImageUrls.forEach(url => URL.revokeObjectURL(url));

    setOriginalFile(null);
    setGeneratedImageUrls([]);
    setSelectedImageUrl(null);
    setError(null);
    setAppState('IDLE');
    setEditPrompt('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = useCallback((file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      handleStartOver();
      setOriginalFile(file);
      handleInitialGeneration(file);
    } else if (file) {
      setError('Por favor, selecione um arquivo de imagem válido (JPEG, PNG, WEBP, etc.).');
      setAppState('IDLE');
    }
  }, [handleInitialGeneration]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files?.[0] ?? null);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (appState === 'IDLE') {
      handleFileSelect(e.dataTransfer.files?.[0] ?? null);
    }
  };

  const handleDragEvents = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (appState !== 'IDLE') return;
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleContainerClick = () => {
    if (appState === 'IDLE') {
      fileInputRef.current?.click();
    }
  };

  const handleDownload = () => {
    if (selectedImageUrl) {
      const link = document.createElement('a');
      link.href = selectedImageUrl;
      const originalName = originalFile?.name.split('.').slice(0, -1).join('.') || 'produto';
      link.download = `${originalName}-${generationMode.toLowerCase()}-editado.jpeg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  const handleSelectImage = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setAppState('EDITING');
  }
  
  const handleBackToGrid = () => {
    setSelectedImageUrl(null);
    setAppState('SUCCESS');
  }

  const renderMainModule = () => {
    switch (appState) {
      case 'PROCESSING':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
            <Loader />
            <p className="text-slate-500 mt-4 text-sm font-medium">{processingMessage}</p>
          </div>
        );
      case 'SUCCESS':
        return (
          <div className="grid grid-cols-2 grid-rows-2 gap-1 sm:gap-2 w-full h-full p-1 sm:p-2 bg-slate-200">
            {generatedImageUrls.map((url, index) => (
              <button key={index} onClick={() => handleSelectImage(url)} className="relative w-full h-full rounded-lg overflow-hidden group focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-75">
                <img src={url} alt={`Generated variation ${index + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-300">
                  <EditIcon className="w-8 h-8 text-white mb-2" />
                  <p className="text-white font-bold text-sm sm:text-base">Selecionar para Editar</p>
                </div>
              </button>
            ))}
          </div>
        )
      case 'EDITING':
        return (
           <div className="w-full h-full bg-white">
            <img
              src={selectedImageUrl!}
              alt="Imagem selecionada para edição"
              className="w-full h-full object-contain"
            />
          </div>
        )
      case 'ERROR':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
            <div className="bg-red-100 border border-red-300 text-red-800 rounded-lg p-4 max-w-sm flex items-start gap-3">
              <WarningIcon className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold mb-1">Ocorreu um Erro</h4>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        );
      case 'IDLE':
      default:
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center justify-center space-y-4 text-slate-500 pointer-events-none p-4 text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                <UploadIcon className="w-10 h-10 text-slate-500" />
              </div>
              <p className="text-xl font-semibold text-slate-700">Arraste uma imagem ou clique para selecionar</p>
              <p className="text-sm text-slate-400">4 opções serão geradas automaticamente</p>
            </div>
          </div>
        );
    }
  };

  const renderActionButtons = () => {
    switch(appState) {
        case 'SUCCESS':
            return (
                 <div className="mt-6 flex flex-col items-center justify-center gap-4 animate-fade-in">
                    <p className="font-semibold text-slate-600 text-center">Selecione uma imagem acima para refinar, alterar ou baixar.</p>
                    <button onClick={handleStartOver} className="text-slate-600 hover:text-indigo-600 font-medium transition-colors flex items-center justify-center gap-2 group">
                        <StartOverIcon className="w-5 h-5 text-slate-500 group-hover:text-indigo-500 transition-colors" />
                        Começar de Novo
                    </button>
                 </div>
            )
        case 'EDITING':
            return (
                <div className="w-full mt-6 space-y-4 animate-fade-in">
                    <div className="p-4 border border-slate-200 rounded-lg bg-white">
                        <label htmlFor="edit-prompt" className="block text-sm font-medium text-slate-700 mb-2">Descreva a alteração que você deseja:</label>
                        <textarea
                            id="edit-prompt"
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            placeholder="Ex: adicione um ramo de alecrim ao lado do produto"
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            rows={2}
                        />
                        <button onClick={() => handleRefinement(editPrompt)} disabled={!editPrompt.trim()} className="mt-2 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed">
                            <EditIcon className="w-5 h-5" />
                            Alterar com Prompt
                        </button>
                    </div>

                    <div className="flex items-center">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink mx-4 text-slate-400 text-xs font-medium">OU</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                     <button onClick={() => handleRefinement('Crie mais 4 variações desta imagem, mantendo o mesmo estilo geral, mas com pequenas alterações na composição, iluminação e nos elementos de fundo.')} className="w-full flex items-center justify-center gap-2 bg-white text-slate-700 font-semibold py-2 px-4 rounded-lg shadow-sm border border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      <VariationIcon className="w-5 h-5" />
                      Gerar Mais Variações
                    </button>

                    <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                        <button onClick={handleBackToGrid} className="flex items-center justify-center gap-2 text-slate-600 hover:text-indigo-600 font-medium transition-colors group">
                            <BackIcon className="w-5 h-5 text-slate-500 group-hover:text-indigo-500 transition-colors" />
                            Voltar
                        </button>
                        <div className="flex items-center gap-4">
                           <button onClick={handleDownload} className="flex items-center justify-center gap-2 bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-600">
                              <DownloadIcon className="w-5 h-5" />
                              Baixar
                            </button>
                            <button onClick={handleStartOver} className="text-slate-500 hover:text-red-600 text-sm font-medium transition-colors">
                                Descartar
                            </button>
                        </div>
                    </div>
                </div>
            )
        case 'ERROR':
            return (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap animate-fade-in">
                    <button onClick={() => originalFile && handleInitialGeneration(originalFile)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <RetryIcon className="w-5 h-5" />
                        Tentar Novamente
                    </button>
                    <button onClick={handleStartOver} className="w-full sm:w-auto text-slate-600 hover:text-indigo-600 font-medium transition-colors flex items-center justify-center gap-2 group">
                        <StartOverIcon className="w-5 h-5 text-slate-500 group-hover:text-indigo-500 transition-colors" />
                        Começar de Novo
                    </button>
                </div>
            )
        default:
            return null;
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex items-center justify-center p-4 font-sans">
      <main className="w-full max-w-xl mx-auto flex flex-col items-center">
        <div className={`w-full transition-opacity duration-300 ${appState !== 'IDLE' ? 'animate-fade-in' : ''}`}>
            <div className={`mb-6 w-full max-w-sm mx-auto bg-slate-200 rounded-lg p-1 flex transition-all duration-300 ${appState === 'PROCESSING' ? 'opacity-50 pointer-events-none' : ''}`}>
                <button
                onClick={() => setGenerationMode('ECOMMERCE')}
                className={`w-1/2 rounded-md py-2 text-sm font-semibold transition-all duration-300 ease-in-out ${
                    generationMode === 'ECOMMERCE'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'bg-transparent text-slate-500 hover:bg-slate-300/60'
                }`}
                aria-pressed={generationMode === 'ECOMMERCE'}
                >
                Foto de Estúdio
                </button>
                <button
                onClick={() => setGenerationMode('SOCIAL')}
                className={`w-1/2 rounded-md py-2 text-sm font-semibold transition-all duration-300 ease-in-out ${
                    generationMode === 'SOCIAL'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'bg-transparent text-slate-500 hover:bg-slate-300/60'
                }`}
                aria-pressed={generationMode === 'SOCIAL'}
                >
                Foto Ambiente
                </button>
            </div>

            <input type="file" ref={fileInputRef} id="file-upload" style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
            <div
            className={`w-full aspect-square rounded-2xl shadow-lg border-2 border-dashed  overflow-hidden relative transition-all duration-300 
                ${appState === 'IDLE' ? 'border-slate-300 bg-white hover:border-slate-400 cursor-pointer' : 'border-transparent bg-slate-200'}
                ${isDragging ? 'border-indigo-600 bg-indigo-50 scale-105' : ''}`
            }
            onDrop={handleDrop} onDragOver={handleDragEvents} onDragEnter={handleDragEvents} onDragLeave={handleDragEvents}
            onClick={handleContainerClick}
            >
            {renderMainModule()}
            </div>
            {error && appState === 'IDLE' && <p className="mt-4 text-center text-sm text-red-600 animate-fade-in">{error}</p>}
            {renderActionButtons()}
        </div>
      </main>
    </div>
  );
}
