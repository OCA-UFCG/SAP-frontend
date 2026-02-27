export const GET_HOME_PAGE = `
  query GetHomePage {
    bannerCollection(limit: 1) {
      items {
        title
        subtitle
        linkText
        link
        image {
          url
        }
      }
    }

    secaoSobreCollection {
      items {
        title
        text {
          json
        }
        image {
          url
          title
        }
        includeInAboutSap
      }
    }

    aboutCollection(limit: 1) {
      items {
        sys {
          id
        }
        title
        text {
          json
        }
        image {
          url
          title
          width
          height
        }
      }
    }

    cabealhoSeesCollection(limit: 1) {
      items {
        sys {
          id
        }
     id
        title
        description
      }
    }

    partnersCollection {
      items {
        sys {
          id
        }
        name
        image {
          url
          title
          width
          height
        }
      } 
    } 
    
    footerCollection{
      items {
        id
        name
        path
        appears
      }
    }
  }
`;
