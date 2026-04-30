
import React from 'react';
import { Map as MapIcon, Layers, QrCode, Monitor } from 'lucide-react';

export default function ExamHallsManager() {
    return (
        <div className="bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4 sm:p-8 rounded-2xl shadow-xl max-w-5xl mx-auto border-t-8 border-indigo-500 text-center">
            <header className="mb-10">
                <div className="bg-indigo-100 text-indigo-600 p-5 rounded-full inline-block mb-6 shadow-md">
                    <MapIcon size={48} />
                </div>
                <h2 className="text-4xl font-extrabold text-gray-800 mb-4 tracking-tight">
                    نظام إدارة مخططات الجلوس الامتحانية
                </h2>
                <div className="h-1.5 w-32 bg-indigo-500 mx-auto rounded-full"></div>
            </header>

            <div className="bg-white p-8 rounded-2xl border-2 border-indigo-100 shadow-inner mb-10 text-right space-y-6">
                <p className="text-xl font-bold text-gray-700 leading-relaxed">
                    تستطيع تكوين خرائط جلوس الطلبة الان من خلال ( نظام إدارة مخططات الجلوس الامتحانية ).
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div className="flex items-start gap-3">
                        <div className="bg-cyan-100 p-2 rounded-lg text-cyan-600 mt-1">
                            <Layers size={20} />
                        </div>
                        <p className="text-gray-600 text-md leading-relaxed">
                            سوف تمكنك أداتنا المتطورة من إنشاء قاعات امتحانية بكفاءة عالية، مع توزيع ذكي للطلاب يضمن أفضل استغلال للمساحة.
                        </p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg text-purple-600 mt-1">
                            <QrCode size={20} />
                        </div>
                        <p className="text-gray-600 text-md leading-relaxed">
                            توليد رمز <span className="font-bold text-indigo-600">QR</span> لكل طالب تستطيع مسحه باستخدام كاميرا الموبايل أو الكاميرا المرتبطة بالحاسوب لتسجيل غيابات الطلاب والتلاميذ بدقة متناهية.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3 border-t pt-6">
                    <div className="bg-green-100 p-2 rounded-lg text-green-600 mt-1">
                        <Monitor size={20} />
                    </div>
                    <p className="text-gray-600 text-md leading-relaxed">
                        قم بتصدير أوراق القاعات وإرفاقها مع سجل السيطرة الامتحانية. أتحنا لك إضافة لمساتك الخاصة على القاعات المصدرة ليكون سجل السيطرة الامتحانية لديك مميزاً واحترافياً.
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <p className="text-2xl font-bold text-indigo-700">
                    ✨ ابدأ الآن بتنظيم قاعاتك بلمسة تقنية حديثة!
                </p>
                
                <a 
                    href="https://hussien1977.github.io/qait/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-4 px-12 py-5 bg-gradient-to-r from-indigo-600 to-blue-700 text-white font-bold text-2xl rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1.5 transition-all duration-300 ease-in-out border-b-4 border-indigo-800"
                >
                    <MapIcon size={32} />
                    <span>انشئ قاعاتك الامتحانية الان</span>
                </a>
            </div>

            <footer className="mt-12 pt-6 border-t border-gray-200 text-gray-500 text-sm italic">
                هذه الخدمة مقدمة لتعزيز الكفاءة الإدارية في المؤسسات التعليمية وتوفير الوقت في إدارة المراقبين والطلبة.
            </footer>
        </div>
    );
}
