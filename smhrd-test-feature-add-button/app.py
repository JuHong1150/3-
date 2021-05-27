from io import StringIO
import json
import requests

from flask import Flask
from flask import render_template
from flask import request
from flask import Response

from pytube import YouTube
import pandas as pd
from bs4 import BeautifulSoup
import html
from flask_socketio import SocketIO
from flask_socketio import send, emit

# 머신러닝 관련 모듈
# from tensorflow.keras.preprocessing.text import Tokenizer
from konlpy.tag import Kkma
from konlpy.tag import Okt
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.preprocessing import normalize
import numpy as np

# 머신러닝 관련 모듈 - 영어자막용
from gensim.summarization.summarizer import summarize
from gensim.summarization import keywords

# 머신러닝 관련 모듈 - Q & A(Allennlp)
from allennlp.predictors.predictor import Predictor 


"""
==============================================================
유튜브 자막 생성
--------------------------------------------------------------
==============================================================
"""

def get_youtube_caption(p_video_id):

    # YouTube 객체 생성
    video_id = p_video_id
    watch_url = f'https://youtube.com/watch?v={video_id}'

    yt = YouTube(watch_url)

    # 한글 자막 중 베스트 뽑음
    caption_ko = yt.captions.get("ko")
    caption_ako = yt.captions.get("a.ko")
    caption_for_ko = caption_ko if caption_ko != None else caption_ako
    
    # 영어 자막 중 베스트 뽑음
    caption_en = yt.captions.get("en")
    caption_aen = yt.captions.get("a.en")
    caption_for_en = caption_en if caption_en != None else caption_aen
    
    # 최종 서비스 자막 선택(1순위 한글, 2순위 영어)
    caption_lang = "ko" if caption_for_ko != None else "en"
    caption = caption_for_ko if caption_for_ko != None else caption_for_en
    caption = caption.xml_captions

    # XML -> JSON
    soup = BeautifulSoup(caption, 'lxml-xml')
    tags = soup.find_all('text')

    # 딥러닝, 머신러닝용 raw text 자막
    text = " "
    for tag in tags:
        text = text + html.unescape(tag.text)

    # 대본 보기용 json 자막
    df = pd.DataFrame()
    for tag in tags:
        dt = {
            "dur": [tag["dur"]],
            "start": [tag["start"]],
            "text": html.unescape([tag.text]),
        }
        df = df.append(pd.DataFrame.from_dict(dt), sort=False)

    df.reset_index(drop=True, inplace=True)
    caption_json = df.to_json(orient="records")

    dt = dict(caption_lang=caption_lang, caption_text=text, caption_json=caption_json)

    return dt

def getVideo(searchUrl) :
    content = requests.get(searchUrl).content.decode('utf-8')
    jsonData = json.loads(content)
    print(searchUrl)
#     print(jsonData)

    vdIdList = [] # videoId 리스트
    tlList = [] # 영상 제목 리스트
    chList = [] # 영상 채널명 리스트
    chIdList = [] # 채널 id 리스트
    chThnailList = [] # 영상 채널 썸네일 리스트
    vcList = [] # 조회수 리스트
    summaryList = [] # summary 리스트

    for i in range(0,5) :
        vdIdList.append(jsonData['items'][i]['id']['videoId'])
        chIdList.append(jsonData['items'][i]['snippet']['channelId'])
        url = f'https://www.youtube.com/watch?v={vdIdList[i]}'
        chThUrl = "https://www.googleapis.com/youtube/v3/channels?part=snippet&id="+chIdList[i]+"&key="+APIkey
        chContent = requests.get(chThUrl).content.decode('utf-8')
        chData = json.loads(chContent)
        chData = chData['items'][0]['snippet']['thumbnails']['default']['url']
        chThnailList.append(chData)
        yt = YouTube(url)
        tlList.append(yt.title) # 영상 제목
        chList.append(yt.author) # 영상 채널명
        vcList.append(yt.views) # 영상 조회수
        summaryList.append(summary(vdIdList[i])) # 요약정보

    jData = json.dumps({"chList" : chList,
                           "chThnailList" : chThnailList,
                           "summary" : summaryList,
                           "tlList" : tlList,
                           "vdIdList" : vdIdList,
                           "vcList" : vcList}, indent=2)
    
    return jData





"""
==============================================================
유튜브 자막 머신러닝 부분
--------------------------------------------------------------
==============================================================
"""

# TextRank 관련 코드
class SentenceTokenizer(object):

    def __init__(self):
        self.kkma = Kkma()
        self.okt = Okt()
        self.stopwords = ['중인' ,'만큼', '마찬가지', '꼬집었', "먼저","대한"
        ,"아", "휴", "아이구", "아이쿠", "아이고", "어", "나", "우리", "저희", "따라", "의해", "을", "를", "에", "의", "가", ]
    
    def text2sentences(self, text):
        sentences = self.kkma.sentences(text)
        for idx in range(0, len(sentences)):
            if len(sentences[idx]) <= 10:
                sentences[idx-1] += (' ' + sentences[idx])
                sentences[idx] = ''
        return sentences
    
    def get_nouns(self, sentences):
        nouns = []
        for sentence in sentences:
            if sentence != '':
                nouns.append(' '.join([noun for noun in self.okt.nouns(str(sentence))
                                        if noun not in self.stopwords and len(noun) > 1]))
        return nouns

class GraphMatrix(object):
    def __init__(self):
        self.tfidf = TfidfVectorizer()
        self.cnt_vec = CountVectorizer()
        self.graph_sentence = []

    def build_sent_graph(self, sentence):
        tfidf_mat = self.tfidf.fit_transform(sentence).toarray()
        self.graph_sentence = np.dot(tfidf_mat, tfidf_mat.T)
        return self.graph_sentence

    def build_words_graph(self, sentence):
        cnt_vec_mat = normalize(self.cnt_vec.fit_transform(sentence).toarray().astype(float), axis=0)
        vocab = self.cnt_vec.vocabulary_
        return np.dot(cnt_vec_mat.T, cnt_vec_mat), {vocab[word] : word for word in vocab}


class Rank(object):
    def get_ranks(self, graph, d=0.85): # d = damping factor
        A = graph
        matrix_size = A.shape[0]
        for id in range(matrix_size):
            A[id, id] = 0 # diagonal 부분을 0으로
            link_sum = np.sum(A[:,id]) # A[:, id] = A[:][id]
            if link_sum != 0:
                A[:, id] /= link_sum
            A[:, id] *= -d
            A[id, id] = 1
        B = (1-d) * np.ones((matrix_size, 1))
        ranks = np.linalg.solve(A, B) # 연립방정식 Ax = b
        return {idx: r[0] for idx, r in enumerate(ranks)}

class TextRank(object):
    def __init__(self, text):
        self.sent_tokenize = SentenceTokenizer()
        
        if text[:5] in ('http:', 'https'):
            self.sentences = self.sent_tokenize.url2sentences(text)
        else:
            self.sentences = self.sent_tokenize.text2sentences(text)
            
        self.nouns = self.sent_tokenize.get_nouns(self.sentences)
        self.graph_matrix = GraphMatrix()
        self.sent_graph = self.graph_matrix.build_sent_graph(self.nouns)
        self.words_graph, self.idx2word = self.graph_matrix.build_words_graph(self.nouns)
        self.rank = Rank()
        self.sent_rank_idx = self.rank.get_ranks(self.sent_graph)
        self.sorted_sent_rank_idx = sorted(self.sent_rank_idx, key=lambda k: self.sent_rank_idx[k], reverse=True)
        self.word_rank_idx = self.rank.get_ranks(self.words_graph)
        self.sorted_word_rank_idx = sorted(self.word_rank_idx, key=lambda k: self.word_rank_idx[k], reverse=True)
        
    def summarize(self, sent_num=5):
        summary = []
        index=[]
        for idx in self.sorted_sent_rank_idx[:sent_num]:
            index.append(idx)
        index.sort()
        for idx in index:
            summary.append(self.sentences[idx])
        return summary
    
    def keywords(self, word_num):
        rank = Rank()
        rank_idx = rank.get_ranks(self.words_graph)
        sorted_rank_idx = sorted(rank_idx, key=lambda k: rank_idx[k], reverse=True)
        keywords = []
        index=[]
        for idx in sorted_rank_idx[:word_num]:
            index.append(idx)
        #index.sort()
        for idx in index:
            keywords.append(self.idx2word[idx])
        return keywords


def summarize_ko_caption_to_json(p_text):

    text_rank = TextRank(p_text)

    result_sum_line3 = ' '.join(text_rank.summarize(3))
    result_sum_line7 = ' '.join(text_rank.summarize(7))
    result_sum_line10 = ' '.join(text_rank.summarize(10))

    result_key_item5 = text_rank.keywords(5)

    dt = dict(
        result_sum_line3 = [result_sum_line3],
        result_sum_line7 = [result_sum_line7],
        result_sum_line10 = [result_sum_line10],
        result_key_item5 = [result_key_item5]
    )

    df = pd.DataFrame.from_dict(dt)
    summary_json_ko = df.to_json(orient="records")

    return summary_json_ko


def summarize_en_caption_to_json(p_text):

    summary_json_en = None
    gensim_summary = ""
    gensim_keyword = ""
      
    # Gensim 영어 테스트
    result_sum_line3 = summarize(p_text, word_count=70)
    result_sum_line7 = summarize(p_text, word_count=140)
    result_sum_line10 = summarize(p_text, word_count=250)

    # summarize(text, word_count=30)
    result_key_item5 = keywords(p_text, words=5, lemmatize=True)
    
    dt = dict(
        result_sum_line3 = [result_sum_line3],
        result_sum_line7 = [result_sum_line7],
        result_sum_line10 = [result_sum_line10],
        result_key_item5 = [result_key_item5]
    )
    
    df = pd.DataFrame.from_dict(dt)
    summary_json_en = df.to_json(orient="records")

    return summary_json_en


# Q&A Test
predictor = Predictor.from_path("https://storage.googleapis.com/allennlp-public-models/bidaf-model-2020.03.19.tar.gz")

def question_and_answer(p_text, p_question):
    
    text = p_text
    question = p_question

    result = predictor.predict(
        passage=text,
        question=question
    )

    answer = result['best_span_str']

    return answer



"""
==============================================================
FLASK & FLASK SOCKET 구동
--------------------------------------------------------------
==============================================================
"""

app = Flask(__name__, static_folder='static')
app.config['SECRET_KEY'] = 'flow2kudo!'
socketio = SocketIO(app)
wsgi_app = app.wsgi_app

# # Q & A
# @socketio.on('ask_question')
# def handle_message(data):
#     answer = predictor.predict(
#         passage=stanford_text,
#         question=data
#     )
#     best_answer = answer['best_span_str']
#     # print(best_answer)
#     emit('send_answer', best_answer)
    

@app.route('/search', methods=['GET'])
def get():
    APIkey = "AIzaSyB1ENAhUg71WTj7Lb6XBciRImqHcD8A9Dc"
    searchBox = request.values.get("searchBox") # 검색어
    pageToken = request.values.get("pageToken") # 페이지토큰
    print("이건 받아온 페이지 토큰 값")
    print(pageToken)
    print("이건 받아온 쿼리스트링 값 ")
    print(searchBox)

    searchUrl = "https://www.googleapis.com/youtube/v3/search?part=snippet&order=relevance&q="+ searchBox +"&key=" + APIkey
    print("이건 그냥 검색어 url : " + searchUrl)

    vdIdList = [] # videoId 리스트
    summaryList = [] # summary 리스트

    # 페이지 토큰 있는 경우
    if(pageToken) :
        print("페이지 토큰이 있는 경우")
        searchUrl += "&pageToken="+pageToken
        print("이건 페이지토큰 포함 url : " + searchUrl)
        content = requests.get(searchUrl).content.decode('utf-8')
        jsonData = json.loads(content)

        for i in range(0,5) :
            vdIdList.append(jsonData['items'][i]['id']['videoId'])
            caption = get_youtube_caption(vdIdList[i])
            caption_lang = caption["caption_lang"]
            caption_text = caption["caption_text"]

            if caption_lang == "ko":
                summary = summarize_ko_caption_to_json(caption_text)
            elif caption_lang == "en":
                summary = summarize_en_caption_to_json(caption_text)

            summaryList.append(summary)
        # 검색된 5개의 요약 정보를 summary라는 key의 리스트 value로 넣어서 응답을 받는 페이지의 js에서 반복문으로 리스트의 값 하나씩 뽑아서 넣도록 함
        smJson = json.dumps({"summary" : summaryList})
        print("더보기 눌렀을 때 새로 검색한 요약정보 json.dumps 한거")
        print(smJson)

        return smJson
    else :
        print("그냥 검색만 한 경우")
        content = requests.get(searchUrl).content.decode('utf-8')
        jsonData = json.loads(content)

        for i in range(0,5) :
            vdIdList.append(jsonData['items'][i]['id']['videoId'])
            caption = get_youtube_caption(vdIdList[i])
            caption_lang = caption["caption_lang"]
            caption_text = caption["caption_text"]

            if caption_lang == "ko":
                summary = summarize_ko_caption_to_json(caption_text)
            elif caption_lang == "en":
                summary = summarize_en_caption_to_json(caption_text)

            summaryList.append(summary)
        smJson = json.dumps({"summary" : summaryList})

        return render_template('ytSearchApiIframe.html', searchBox=searchBox, smJson=smJson)


@app.route('/watch')
def main():
    
    video_id = request.args["videoId"]
    caption = get_youtube_caption(video_id)
    caption_lang = caption["caption_lang"]
    caption_text = caption["caption_text"]
    url = 'https://www.youtube.com/watch?v='+video_id
    yt = YouTube(url)
    title = yt.title
    author = yt.author
    print("여기여기")
    print(title)
    print(author)

    if caption_lang == "ko":
        summary = summarize_ko_caption_to_json(caption_text)
    elif caption_lang == "en":
        summary = summarize_en_caption_to_json(caption_text)

    caption = json.dumps({"caption": [caption]})

    # Q & A
    @socketio.on('ask_question')
    def handle_message(data):
        answer = predictor.predict(
            passage=caption_text,
            question=data
        )
        best_answer = answer['best_span_str']
        # print(best_answer)
        emit('send_answer', best_answer)

    #print(smJson)
    return render_template(
        'ytWatch.html', 
        video_id=video_id,
        caption=caption, 
        smJson=summary,
        title=title,
        author=author,

    )


# 자막 내보내기
@app.route("/download/caption", methods=["GET", "POST"])
def download_caption():
    
    output_stream = StringIO()## dataframe을 저장할 IO stream 
    temp_df = pd.DataFrame({'col1':[1,2,3], 'col2':[4,5,6]})## dataframe을 아무거나 만들어주고, 
    temp_df.to_csv(output_stream)## 그 결과를 앞서 만든 IO stream에 저장해줍니다. 
    response = Response(
        output_stream.getvalue(), 
        mimetype='text/csv', 
        content_type='application/octet-stream',
    )
    response.headers["Content-Disposition"] = "attachment; filename=post_export.csv"
    return response

@app.route('/')
def watch():
    
    return render_template('ytSearchMain.html')
  