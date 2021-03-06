import React, { useState, useEffect, useMemo } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { fetchNewsByClass, fetchNewsByClassAndCountry, fetchMeta } from '../api';
import Country from './Country';
import TopicList from './TopicList';
import Loading from './Loading';

const CountryList = () => {
  const [topics, setTopics] = useState([]);
  const [countries, setCountries] = useState([]);
  const [news, setNews] = useState({});
  const [selectedTopic, setSelectedTopic] = useState('');
  
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  // { [country]: { loading: boolean, noMore: { [topic]: boolean } } }
  const [countriesFetchState, setCountriesFetchedState] = useState({});

  // computed value: filter news by currently selected class.
  const filteredNews = useMemo(() => {
    return news[selectedTopic] || {};
  }, [news, selectedTopic]);

  function setLoading(country, bool) {
    setCountriesFetchedState(prev => ({
      ...prev,
      [country]: {
        ...prev[country],
        loading: bool
      }
    }))
  }

  function setNewsByTopic(newNews, topic) {
    setNews(prevNews => {
      return {
        ...prevNews,
        [topic]: newNews
      }
    })
  }

  function addNewsByTopicAndCountry(newEntries, topic, country) {
    setNews(prevNews => {
      const prevEntries = prevNews[topic]?.[country] || [];
      return {
        ...prevNews,
        [topic]: {
          ...prevNews[topic],
          [country]: [...prevEntries, ...newEntries]
        }
      }
    })
  }

  function setNoMoreNews(country, topic) {
    setCountriesFetchedState(prev => {
      let newCountryState = {
        loading: false,
        noMore: {}
      }
      if (prev[country]) {
        newCountryState = {...prev[country]}
      }
      newCountryState.noMore = {
        ...newCountryState.noMore,
        [topic]: true
      }
      return {
        ...prev,
        [country]: newCountryState
      }
    })
  }

  function setAllCountriesLoading(bool) {
    setCountriesFetchedState(prev => {
      let newState = {...prev};
      for (const country of Object.keys(prev)) {
        newState[country] = {
          ...newState[country],
          loading: bool
        }
      }
      return newState;
    })
  }

  async function initialLoad() {
    setIsFetchingMeta(true);
    const metaRes = await fetchMeta();
    setCountries(metaRes.countries);
    for (const c of metaRes.countries) {
      setLoading(c.country, true);
    }
    setTopics(metaRes.topics);
    const firstTopic = metaRes.topics[0];
    setSelectedTopic(firstTopic);
    setIsFetchingMeta(false);
    const firstTopicNews = await fetchNewsByClass(firstTopic, 20);
    for (const c of metaRes.countries) {
      const country = c.country
      if (!firstTopicNews[country] || firstTopicNews[country].length < 20) {
        setNoMoreNews(country, firstTopic);
      }
    }
    setNews({[firstTopic]: firstTopicNews});
    const topicsNum = metaRes.topics.length;
    // fetch other topic news
    const otherClassNews = await Promise.all(metaRes.topics.slice(1, topicsNum).map(c => fetchNewsByClass(c, 20)));
    otherClassNews.forEach((e, i) => {
      const topic = metaRes.topics[i + 1];
      for (const c of metaRes.countries) {
        const country = c.country;
        if (!e[country] || e[country].length < 20) {
          setNoMoreNews(country, topic);
        }
      }
      setNewsByTopic(e, topic);
    })
    setAllCountriesLoading(false);
  }

  async function loadMore(c) {
    const topic = selectedTopic;
    if (countriesFetchState[c]?.loading || countriesFetchState[c]?.noMore?.[topic]) {
      return;
    }
    setLoading(c, true);
    const offset = filteredNews[c] ? filteredNews[c].length : 0;
    const newEntries = await fetchNewsByClassAndCountry(topic, c, offset, 10);
    if (newEntries.length < 10) {
      setNoMoreNews(c, topic)
    }
    addNewsByTopicAndCountry(newEntries, topic, c);
    setLoading(c, false);
  }

    // Run only ones
    useEffect(() => {
      initialLoad();
    }, []);  

  return (
    <Container className="mt-3">
      <TopicList selectedTopic={selectedTopic} topics={topics} changeTopic={setSelectedTopic} />
      {isFetchingMeta ? (
        <div className="text-center">
          <Loading />
        </div>
      ) : (
        <Container>
          <Row>
            {countries.map((c) => (
              <Country
                key={c.country}
                stats={c.stats}
                title={c.name.ja}
                url={c.representativeSiteUrl}
                loading={countriesFetchState[c.country]?.loading}
                entries={filteredNews[c.country] || []}
                topic={selectedTopic}
                loadMore={() => loadMore(c.country)}
              />
            ))}
          </Row>
        </Container>
      )}
    </Container>
  );
};

export default CountryList;
