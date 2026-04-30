
import React, { useState, useMemo } from 'react';
import * as ReactDOM from 'react-dom/client';
import type { ClassData, SchoolSettings, Student } from '../../types.ts';
import { GRADE_LEVELS } from '../../constants.ts';
import { Loader2, FileDown, ClipboardList } from 'lucide-react';
import PrimaryOralExamPDFPage from './PrimaryOralExamPDFPage.tsx';

declare const jspdf: any;
declare const html2canvas: any;

const STUDENTS_PER_PAGE = 21;

export default function PrimaryOralExamExporter({ classes, settings }: { classes: ClassData[], settings: SchoolSettings }) {
    const [selectedStage, setSelectedStage] = useState('');
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
    const [logos, setLogos] = useState<{ school: string | null; ministry: string | null }>({ school: null, ministry: null });
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    const primaryStages = useMemo(() => GRADE_LEVELS.filter(l => l.includes('ابتدائي')), []);

    const classesInSelectedStage = useMemo(() => {
        return selectedStage ? classes.filter(c => c.stage === selectedStage) : [];
    }, [selectedStage, classes]);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'school' | 'ministry') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setLogos(prev => ({ ...prev, [type]: event.target?.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleExportPdf = async () => {
        if (selectedClassIds.length === 0) {
            alert('يرجى اختيار شعبة واحدة على الأقل.');
            return;
        }

        setIsExporting(true);
        setExportProgress(0);

        const { jsPDF } = jspdf;
        // Changed orientation to 'p' (Portrait)
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const tempContainer = document.createElement('div');
        Object.assign(tempContainer.style, { position: 'absolute', left: '-9999px', top: '0' });
        document.body.appendChild(tempContainer);
        const root = ReactDOM.createRoot(tempContainer);

        const renderComponent = (component: React.ReactElement) => new Promise<void>(resolve => {
            root.render(component);
            setTimeout(resolve, 500);
        });

        const selectedClassesData = classes.filter(c => selectedClassIds.includes(c.id));
        const allPages: { classData: ClassData, students: Student[], startingIndex: number }[] = [];

        selectedClassesData.forEach(classData => {
            const sortedStudents = [...(classData.students || [])].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
            for (let i = 0; i < sortedStudents.length; i += STUDENTS_PER_PAGE) {
                allPages.push({
                    classData,
                    students: sortedStudents.slice(i, i + STUDENTS_PER_PAGE),
                    startingIndex: i
                });
            }
            if (sortedStudents.length === 0) {
                allPages.push({ classData, students: [], startingIndex: 0 });
            }
        });

        try {
            await document.fonts.ready;
            for (let i = 0; i < allPages.length; i++) {
                const { classData, students, startingIndex } = allPages[i];
                await renderComponent(
                    <PrimaryOralExamPDFPage
                        settings={settings}
                        logos={logos}
                        students={students}
                        classData={classData}
                        startingIndex={startingIndex}
                    />
                );

                const reportElement = tempContainer.children[0] as HTMLElement;
                const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
                setExportProgress(Math.round(((i + 1) / allPages.length) * 100));
            }
            pdf.save(`قوائم_الشفوي_ابتدائي-${selectedStage}.pdf`);
        } catch (error) {
            console.error("PDF Export error:", error);
            alert(`حدث خطأ أثناء التصدير: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            root.unmount();
            document.body.removeChild(tempContainer);
            setIsExporting(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">إعداد قوائم الشفوي (ابتدائية)</h2>
            
            {isExporting && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex flex-col justify-center items-center z-50 text-white">
                    <Loader2 className="animate-spin h-16 w-16 mb-4" />
                    <p className="text-2xl font-bold mb-2">جاري التصدير...</p>
                    <div className="w-1/2 bg-gray-600 rounded-full h-4">
                        <div className="bg-cyan-500 h-4 rounded-full" style={{ width: `${exportProgress}%` }}></div>
                    </div>
                    <p className="mt-2 text-lg">{exportProgress}%</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className="block text-md font-bold text-gray-700 mb-2">1. اختر المرحلة الدراسية</label>
                        <select 
                            onChange={e => { setSelectedStage(e.target.value); setSelectedClassIds([]); }} 
                            value={selectedStage} 
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                        >
                            <option value="">-- اختر مرحلة --</option>
                            {primaryStages.map(level => <option key={level} value={level}>{level}</option>)}
                        </select>
                    </div>

                    {selectedStage && (
                        <div>
                            <label className="block text-md font-bold text-gray-700 mb-2">2. اختر الشعبة (أو الشعب)</label>
                            <div className="space-y-2 max-h-48 overflow-y-auto p-2 border rounded-lg bg-gray-50">
                                {classesInSelectedStage.length > 0 ? classesInSelectedStage.map(c => (
                                    <label key={c.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedClassIds.includes(c.id)} 
                                            onChange={() => setSelectedClassIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])} 
                                            className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                        />
                                        <span className="font-semibold">{c.section}</span>
                                        <span className="text-sm text-gray-500">({(c.students || []).length} تلميذ)</span>
                                    </label>
                                )) : <p className="text-gray-500">لا توجد شعب لهذه المرحلة.</p>}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-md font-bold text-gray-700 mb-2">3. الشعارات (اختياري)</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-600">شعار الوزارة</label>
                                <input type="file" onChange={e => handleLogoChange(e, 'ministry')} accept="image/*" className="mt-1 block w-full text-xs text-gray-500" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600">شعار المدرسة</label>
                                <input type="file" onChange={e => handleLogoChange(e, 'school')} accept="image/*" className="mt-1 block w-full text-xs text-gray-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t pt-6 mt-8 flex justify-center">
                <button 
                    onClick={handleExportPdf} 
                    disabled={selectedClassIds.length === 0 || isExporting} 
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition shadow-md disabled:bg-gray-400"
                >
                    <FileDown size={20} />
                    <span>تصدير قوائم الشفوي (PDF)</span>
                </button>
            </div>
        </div>
    );
}
