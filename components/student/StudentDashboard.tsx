import React, { useState, useMemo, useRef } from 'react';
import type { Student, StudentEvaluation, EvaluationRating } from '../../types.ts';
import { Star, BarChart, X, Camera, Loader2 } from 'lucide-react';
import { APP_LOGO_URL } from '../../constants.ts';

const RATING_MAP: Record<EvaluationRating, { value: number; color: string; }> = {
    'ممتاز': { value: 6, color: 'text-green-500' },
    'جيد جدا': { value: 5, color: 'text-cyan-500' },
    'جيد': { value: 4, color: 'text-teal-500' },
    'متوسط': { value: 3, color: 'text-blue-500' },
    'ضعيف': { value: 2, color: 'text-orange-500' },
    'ضعيف جدا': { value: 1, color: 'text-red-500' },
};

const INVERSE_RATING_MAP: Record<number, EvaluationRating> = {
    6: 'ممتاز',
    5: 'جيد جدا',
    4: 'جيد',
    3: 'متوسط',
    2: 'ضعيف',
    1: 'ضعيف جدا',
};

interface StudentDashboardProps {
    evaluations: StudentEvaluation[];
    studentData: Student | null;
    onPhotoUpdate: (photoBlob: Blob) => Promise<void>;
}

export default function StudentDashboard({ evaluations, studentData, onPhotoUpdate }: StudentDashboardProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const overallEvaluation = useMemo(() => {
        if (evaluations.length === 0) {
            return { text: 'لا يوجد تقييم حتى الآن', color: 'text-gray-500' };
        }
        const totalValue = evaluations.reduce((sum, e) => sum + (RATING_MAP[e.rating]?.value || 0), 0);
        const averageValue = Math.round(totalValue / evaluations.length);
        const ratingText = INVERSE_RATING_MAP[averageValue] || 'متوسط';
        
        return { text: ratingText, color: RATING_MAP[ratingText]?.color || 'text-gray-500' };
    }, [evaluations]);

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            await onPhotoUpdate(file);
        } catch (error) {
            console.error("Photo update failed:", error);
            alert("فشل تحديث الصورة.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-lg text-center">
                
                <div className="w-40 h-40 mx-auto mb-4 relative group">
                    <img 
                        src={studentData?.photoUrl || APP_LOGO_URL} 
                        alt="صورة الطالب" 
                        className="w-full h-full object-cover rounded-full border-4 border-cyan-500 bg-gray-200"
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoChange}
                        accept="image/jpeg,image/png"
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={isUploading}
                    >
                        {isUploading ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <>
                                <Camera size={32} />
                                <span className="absolute bottom-2 text-xs font-semibold">تغيير</span>
                            </>
                        )}
                    </button>
                </div>

                <h1 className="text-3xl font-bold text-gray-800">{studentData?.name || 'اسم الطالب'}</h1>

                <h2 className="text-xl font-semibold text-gray-600 mb-2 mt-6">تقييمك العام</h2>
                <div className={`flex items-center justify-center gap-2 text-5xl font-bold ${overallEvaluation.color}`}>
                    <Star className="w-12 h-12" />
                    <span>{overallEvaluation.text}</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">هذا التقييم هو متوسط تقييماتك في جميع المواد.</p>

                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition-transform transform hover:scale-105"
                >
                    <BarChart size={20} />
                    عرض تقييمات المواد
                </button>
            </div>

            {isModalOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div 
                        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-2xl font-bold">تقييم المواد</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full"><X/></button>
                        </div>
                        {evaluations.length > 0 ? (
                            <div className="max-h-[60vh] overflow-y-auto">
                                <table className="w-full text-right">
                                    <thead className="sticky top-0 bg-gray-100">
                                        <tr>
                                            <th className="p-3 font-semibold">المادة الدراسية</th>
                                            <th className="p-3 font-semibold">التقييم</th>
                                            <th className="p-3 font-semibold">الأستاذ المقيم</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {evaluations.map((evaluation, index) => (
                                            <tr key={evaluation.id} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                                <td className="p-3 font-medium">{evaluation.subjectName}</td>
                                                <td className={`p-3 font-bold ${RATING_MAP[evaluation.rating]?.color}`}>{evaluation.rating}</td>
                                                <td className="p-3 text-gray-600">{evaluation.teacherName}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-8">لم يقم المدرسون بتقييمك في أي مادة بعد.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}